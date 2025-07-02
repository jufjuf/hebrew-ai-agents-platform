import { ChatOpenAI } from '@langchain/openai';
import { SystemMessage, HumanMessage, AIMessage } from '@langchain/core/messages';
import { logger } from '../../utils/logger';
import { hebrewNLP } from '../hebrew-nlp';
import { vectorStore } from '../vector-store';
import { Agent, Conversation, Message } from '@prisma/client';
import { prisma } from '../../database/connection';

export interface AgentContext {
  agent: Agent;
  conversation: Conversation;
  history: Message[];
  userInput: string;
  metadata?: any;
}

export interface AgentResponse {
  content: string;
  confidence: number;
  suggestedActions?: string[];
  metadata?: any;
}

export class AgentEngine {
  private models: Map<string, ChatOpenAI>;

  constructor() {
    this.models = new Map();
    this.initializeModels();
  }

  private initializeModels() {
    // Initialize different models
    const models = [
      { name: 'gpt-4', temperature: 0.7 },
      { name: 'gpt-4-turbo-preview', temperature: 0.7 },
      { name: 'gpt-3.5-turbo', temperature: 0.7 }
    ];

    for (const model of models) {
      this.models.set(model.name, new ChatOpenAI({
        modelName: model.name,
        temperature: model.temperature,
        openAIApiKey: process.env.OPENAI_API_KEY,
      }));
    }
  }

  /**
   * Process user input and generate agent response
   */
  async processMessage(context: AgentContext): Promise<AgentResponse> {
    try {
      // Analyze Hebrew text
      const textAnalysis = await hebrewNLP.analyzeText(context.userInput);
      logger.info('Text analysis completed', { 
        isHebrew: textAnalysis.isHebrew,
        entities: textAnalysis.entities.length,
        sentiment: textAnalysis.sentiment.label
      });

      // Get relevant context from knowledge base
      const relevantDocs = await this.getRelevantContext(
        context.agent.id,
        textAnalysis.normalizedText
      );

      // Build conversation messages
      const messages = this.buildMessages(context, textAnalysis, relevantDocs);

      // Get model response
      const model = this.models.get(context.agent.model) || this.models.get('gpt-4')!;
      const response = await model.invoke(messages);

      // Post-process response
      const processedResponse = await this.postProcessResponse(
        response.content.toString(),
        textAnalysis.isHebrew
      );

      // Save message to database
      await this.saveMessages(context, processedResponse.content);

      return processedResponse;
    } catch (error) {
      logger.error('Agent engine error:', error);
      throw error;
    }
  }

  /**
   * Get relevant context from knowledge base
   */
  private async getRelevantContext(
    agentId: string,
    query: string,
    limit: number = 5
  ): Promise<string[]> {
    try {
      const results = await vectorStore.similaritySearch(
        query,
        limit,
        { agentId }
      );

      return results.map(doc => doc.pageContent);
    } catch (error) {
      logger.error('Failed to get relevant context:', error);
      return [];
    }
  }

  /**
   * Build messages for LLM
   */
  private buildMessages(
    context: AgentContext,
    textAnalysis: any,
    relevantDocs: string[]
  ): (SystemMessage | HumanMessage | AIMessage)[] {
    const messages: (SystemMessage | HumanMessage | AIMessage)[] = [];

    // System message with agent prompt
    let systemPrompt = context.agent.prompt;
    
    // Add Hebrew-specific instructions
    if (textAnalysis.isHebrew) {
      systemPrompt += `\n\nחשוב: המשתמש כותב בעברית. יש להשיב בעברית תקנית וברורה. שים לב לדקדוק נכון ולשימוש בסימני פיסוק מתאימים.`;
    }

    // Add relevant context
    if (relevantDocs.length > 0) {
      systemPrompt += `\n\nמידע רלוונטי מבסיס הידע:\n${relevantDocs.join('\n\n')}`;
    }

    messages.push(new SystemMessage(systemPrompt));

    // Add conversation history
    for (const msg of context.history.slice(-10)) { // Last 10 messages
      if (msg.role === 'USER') {
        messages.push(new HumanMessage(msg.content));
      } else if (msg.role === 'ASSISTANT') {
        messages.push(new AIMessage(msg.content));
      }
    }

    // Add current user message
    messages.push(new HumanMessage(context.userInput));

    return messages;
  }

  /**
   * Post-process agent response
   */
  private async postProcessResponse(
    content: string,
    isHebrew: boolean
  ): Promise<AgentResponse> {
    let processedContent = content;

    // Process Hebrew text
    if (isHebrew) {
      // Fix RTL issues
      processedContent = this.fixRTLFormatting(processedContent);
      
      // Ensure proper Hebrew formatting
      const hebrewAnalysis = await hebrewNLP.analyzeText(processedContent);
      processedContent = hebrewAnalysis.normalizedText;
    }

    // Extract suggested actions
    const suggestedActions = this.extractSuggestedActions(processedContent);

    return {
      content: processedContent,
      confidence: 0.95, // Calculate based on model response
      suggestedActions,
      metadata: {
        language: isHebrew ? 'he' : 'en',
        processedAt: new Date().toISOString()
      }
    };
  }

  /**
   * Fix RTL formatting issues
   */
  private fixRTLFormatting(text: string): string {
    // Add RTL marks where necessary
    // Fix mixed Hebrew-English text
    return text
      .replace(/(\d+)/g, '\u202D$1\u202C') // Wrap numbers with LTR marks
      .replace(/([a-zA-Z]+)/g, '\u202D$1\u202C'); // Wrap English with LTR marks
  }

  /**
   * Extract suggested actions from response
   */
  private extractSuggestedActions(content: string): string[] {
    const actions: string[] = [];
    
    // Look for action patterns
    const actionPatterns = [
      /האם תרצה ש(.+?)\?/g,
      /האם אוכל לעזור ב(.+?)\?/g,
      /Would you like me to (.+?)\?/g,
      /Can I help you with (.+?)\?/g
    ];

    for (const pattern of actionPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        actions.push(match[1].trim());
      }
    }

    return actions;
  }

  /**
   * Save messages to database
   */
  private async saveMessages(
    context: AgentContext,
    assistantContent: string
  ): Promise<void> {
    try {
      // Save user message
      await prisma.message.create({
        data: {
          conversationId: context.conversation.id,
          role: 'USER',
          content: context.userInput,
          metadata: context.metadata
        }
      });

      // Save assistant message
      await prisma.message.create({
        data: {
          conversationId: context.conversation.id,
          role: 'ASSISTANT',
          content: assistantContent,
          metadata: {
            model: context.agent.model,
            agentId: context.agent.id
          }
        }
      });
    } catch (error) {
      logger.error('Failed to save messages:', error);
    }
  }

  /**
   * Handle function calls
   */
  async handleFunctionCall(
    context: AgentContext,
    functionName: string,
    parameters: any
  ): Promise<any> {
    // Implement function calling logic here
    logger.info('Function call:', { functionName, parameters });
    
    // Add your function implementations
    switch (functionName) {
      case 'search_knowledge_base':
        return this.getRelevantContext(context.agent.id, parameters.query);
      case 'translate':
        return hebrewNLP.translate(parameters.text, parameters.targetLang);
      // Add more functions as needed
      default:
        throw new Error(`Unknown function: ${functionName}`);
    }
  }
}

export const agentEngine = new AgentEngine();