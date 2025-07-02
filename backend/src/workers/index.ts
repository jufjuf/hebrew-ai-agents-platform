import Bull from 'bull';
import { logger } from '../utils/logger';
import { prisma } from '../database/connection';
import { vectorStore } from '../services/vector-store';
import { hebrewNLP } from '../services/hebrew-nlp';
import { agentEngine } from '../services/agent-engine';
import { Document } from 'langchain/document';

// Create queues
const queues = {
  documentProcessing: new Bull('document-processing', {
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
    },
  }),
  conversationAnalysis: new Bull('conversation-analysis', {
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
    },
  }),
  messageProcessing: new Bull('message-processing', {
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
    },
  }),
};

// Document processing worker
queues.documentProcessing.process(async (job) => {
  const { documentId, content, knowledgeBaseId, agentId } = job.data;
  
  logger.info(`Processing document ${documentId} for knowledge base ${knowledgeBaseId}`);
  
  try {
    // Analyze text
    const analysis = await hebrewNLP.analyzeText(content);
    
    // Create chunks (for long documents)
    const chunks = chunkText(analysis.normalizedText, 1000); // 1000 chars per chunk
    
    // Create documents for vector store
    const documents = chunks.map((chunk, index) => 
      new Document({
        pageContent: chunk,
        metadata: {
          documentId,
          knowledgeBaseId,
          agentId,
          chunkIndex: index,
          totalChunks: chunks.length,
          language: analysis.language,
          isHebrew: analysis.isHebrew,
        },
      })
    );
    
    // Add to vector store
    await vectorStore.addDocuments(documents, { agentId });
    
    // Update document status
    await prisma.document.update({
      where: { id: documentId },
      data: {
        metadata: {
          processed: true,
          processedAt: new Date(),
          chunks: chunks.length,
          analysis: {
            entities: analysis.entities,
            sentiment: analysis.sentiment,
          },
        },
      },
    });
    
    logger.info(`Document ${documentId} processed successfully`);
    return { success: true, chunks: chunks.length };
  } catch (error) {
    logger.error(`Failed to process document ${documentId}:`, error);
    throw error;
  }
});

// Conversation analysis worker
queues.conversationAnalysis.process(async (job) => {
  const { conversationId } = job.data;
  
  logger.info(`Analyzing conversation ${conversationId}`);
  
  try {
    // Get conversation with messages
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    
    if (!conversation) {
      throw new Error('Conversation not found');
    }
    
    // Analyze each message
    const messageAnalyses = await Promise.all(
      conversation.messages.map(async (message) => {
        if (message.role === 'USER') {
          const analysis = await hebrewNLP.analyzeText(message.content);
          return {
            messageId: message.id,
            sentiment: analysis.sentiment,
            entities: analysis.entities,
            isHebrew: analysis.isHebrew,
          };
        }
        return null;
      })
    );
    
    // Filter out null values
    const validAnalyses = messageAnalyses.filter(a => a !== null);
    
    // Calculate overall metrics
    const avgSentiment = validAnalyses.length > 0
      ? validAnalyses.reduce((sum, a) => sum + a!.sentiment.score, 0) / validAnalyses.length
      : 0;
    
    const overallSentiment = avgSentiment > 0.2 ? 'positive' : 
                            avgSentiment < -0.2 ? 'negative' : 'neutral';
    
    // Extract all entities
    const allEntities = validAnalyses.flatMap(a => a!.entities);
    
    // Group entities by type
    const entitiesByType = allEntities.reduce((acc, entity) => {
      if (!acc[entity.type]) {
        acc[entity.type] = [];
      }
      acc[entity.type].push(entity.text);
      return acc;
    }, {} as Record<string, string[]>);
    
    // Update conversation metadata
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        metadata: {
          ...conversation.metadata,
          analysis: {
            sentiment: {
              overall: overallSentiment,
              score: avgSentiment,
              breakdown: validAnalyses.map(a => ({
                messageId: a!.messageId,
                score: a!.sentiment.score,
                label: a!.sentiment.label,
              })),
            },
            entities: entitiesByType,
            language: validAnalyses.some(a => a!.isHebrew) ? 'he' : 'en',
            analyzedAt: new Date(),
          },
        },
      },
    });
    
    logger.info(`Conversation ${conversationId} analyzed successfully`);
    return { success: true, sentiment: overallSentiment };
  } catch (error) {
    logger.error(`Failed to analyze conversation ${conversationId}:`, error);
    throw error;
  }
});

// Message processing worker (for async message handling)
queues.messageProcessing.process(async (job) => {
  const { conversationId, messageContent, userId } = job.data;
  
  logger.info(`Processing message for conversation ${conversationId}`);
  
  try {
    // Get conversation with agent
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        agent: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 10, // Last 10 messages for context
        },
      },
    });
    
    if (!conversation) {
      throw new Error('Conversation not found');
    }
    
    // Process message with agent engine
    const response = await agentEngine.processMessage({
      agent: conversation.agent,
      conversation,
      history: conversation.messages.reverse(),
      userInput: messageContent,
      metadata: { processedByWorker: true },
    });
    
    // The response is already saved by the agent engine
    
    logger.info(`Message processed for conversation ${conversationId}`);
    return { success: true, responseLength: response.content.length };
  } catch (error) {
    logger.error(`Failed to process message for conversation ${conversationId}:`, error);
    throw error;
  }
});

// Helper function to chunk text
function chunkText(text: string, chunkSize: number): string[] {
  const chunks: string[] = [];
  const sentences = text.split(/[.!?]+/);
  let currentChunk = '';
  
  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > chunkSize) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = sentence;
    } else {
      currentChunk += (currentChunk ? '. ' : '') + sentence;
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

// Error handling
Object.values(queues).forEach(queue => {
  queue.on('error', (error) => {
    logger.error('Queue error:', error);
  });
  
  queue.on('failed', (job, error) => {
    logger.error(`Job ${job.id} failed:`, error);
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Worker shutting down...');
  
  await Promise.all(
    Object.values(queues).map(queue => queue.close())
  );
  
  process.exit(0);
});

logger.info('Workers started successfully');

export { queues };