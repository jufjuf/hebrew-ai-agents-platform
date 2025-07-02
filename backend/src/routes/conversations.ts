import { Router } from 'express';
import { param, query, body, validationResult } from 'express-validator';
import { prisma } from '../database/connection';
import { asyncHandler } from '../middleware/errorHandler';
import { AppError } from '../middleware/errorHandler';
import { authMiddleware } from '../middleware/auth';
import { checkPermission } from '../middleware/permissions';
import { logger } from '../utils/logger';
import { agentEngine } from '../services/agent-engine';
import { io } from '../index';
import { hebrewNLP } from '../services/hebrew-nlp';

const router = Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

/**
 * @route GET /api/conversations
 * @desc Get conversations with filters
 * @access Private
 */
router.get('/', asyncHandler(async (req, res) => {
  const {
    agentId,
    status,
    channel,
    search,
    startDate,
    endDate,
    page = 1,
    limit = 20,
  } = req.query;

  // Build query filters
  const where: any = {};

  // Get user's accessible agents
  const userOrgs = await prisma.userOrganization.findMany({
    where: { userId: req.user.id },
    select: { organizationId: true },
  });

  const accessibleAgents = await prisma.agent.findMany({
    where: {
      organizationId: { in: userOrgs.map(org => org.organizationId) },
    },
    select: { id: true },
  });

  where.agentId = { in: accessibleAgents.map(agent => agent.id) };

  if (agentId) {
    where.agentId = agentId as string;
  }

  if (status) {
    where.status = status as string;
  }

  if (channel) {
    where.channel = channel as string;
  }

  if (startDate || endDate) {
    where.startedAt = {};
    if (startDate) {
      where.startedAt.gte = new Date(startDate as string);
    }
    if (endDate) {
      where.startedAt.lte = new Date(endDate as string);
    }
  }

  // Search in messages if search term provided
  if (search) {
    const messageIds = await prisma.message.findMany({
      where: {
        content: { contains: search as string, mode: 'insensitive' },
      },
      select: { conversationId: true },
      distinct: ['conversationId'],
    });
    where.id = { in: messageIds.map(m => m.conversationId) };
  }

  // Calculate pagination
  const skip = (Number(page) - 1) * Number(limit);

  // Get conversations with pagination
  const [conversations, total] = await Promise.all([
    prisma.conversation.findMany({
      where,
      include: {
        agent: {
          select: {
            id: true,
            name: true,
            hebrewName: true,
          },
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        _count: {
          select: { messages: true },
        },
      },
      skip,
      take: Number(limit),
      orderBy: { startedAt: 'desc' },
    }),
    prisma.conversation.count({ where }),
  ]);

  // Calculate additional metrics
  const conversationsWithMetrics = await Promise.all(
    conversations.map(async (conv) => {
      // Get last message
      const lastMessage = await prisma.message.findFirst({
        where: { conversationId: conv.id },
        orderBy: { createdAt: 'desc' },
      });

      // Calculate duration
      const duration = conv.endedAt
        ? Math.floor((conv.endedAt.getTime() - conv.startedAt.getTime()) / 1000)
        : null;

      return {
        ...conv,
        lastMessage,
        duration,
      };
    })
  );

  res.json({
    success: true,
    data: {
      conversations: conversationsWithMetrics,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    },
  });
}));

/**
 * @route GET /api/conversations/:id
 * @desc Get conversation details with messages
 * @access Private
 */
router.get('/:id', [
  param('id').isUUID(),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError('Invalid conversation ID', 400);
  }

  const { id } = req.params;

  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: {
      agent: true,
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      messages: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!conversation) {
    throw new AppError('Conversation not found', 404);
  }

  // Check permissions
  await checkPermission(req.user, 'read', 'conversation', conversation.agent.organizationId);

  // Analyze conversation sentiment
  const sentimentAnalysis = await analyzeConversationSentiment(conversation.messages);

  res.json({
    success: true,
    data: {
      conversation: {
        ...conversation,
        sentimentAnalysis,
      },
    },
  });
}));

/**
 * @route POST /api/conversations
 * @desc Start a new conversation
 * @access Private
 */
router.post('/', [
  body('agentId').isUUID(),
  body('channel').optional().isIn(['web', 'whatsapp', 'telegram', 'facebook', 'slack', 'discord', 'sms', 'email']),
  body('metadata').optional().isObject(),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError('Validation failed', 400);
  }

  const { agentId, channel = 'web', metadata } = req.body;

  // Get agent
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
  });

  if (!agent || !agent.isActive) {
    throw new AppError('Agent not found or inactive', 404);
  }

  // Check permissions
  await checkPermission(req.user, 'create', 'conversation', agent.organizationId);

  // Create conversation
  const conversation = await prisma.conversation.create({
    data: {
      agentId,
      userId: req.user.id,
      channel,
      metadata,
    },
    include: {
      agent: {
        select: {
          id: true,
          name: true,
          hebrewName: true,
        },
      },
    },
  });

  logger.info(`Conversation started: ${conversation.id} with agent: ${agent.name}`);

  // Emit event
  io.to(`user:${req.user.id}`).emit('conversation:started', {
    conversationId: conversation.id,
    agentName: agent.name,
  });

  res.status(201).json({
    success: true,
    message: 'Conversation started',
    data: { conversation },
  });
}));

/**
 * @route POST /api/conversations/:id/messages
 * @desc Send a message in a conversation
 * @access Private
 */
router.post('/:id/messages', [
  param('id').isUUID(),
  body('content').notEmpty(),
  body('metadata').optional().isObject(),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError('Validation failed', 400);
  }

  const { id } = req.params;
  const { content, metadata } = req.body;

  // Get conversation with agent and history
  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: {
      agent: true,
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 20, // Last 20 messages for context
      },
    },
  });

  if (!conversation) {
    throw new AppError('Conversation not found', 404);
  }

  if (conversation.status !== 'ACTIVE') {
    throw new AppError('Conversation is not active', 400);
  }

  // Check permissions
  await checkPermission(req.user, 'update', 'conversation', conversation.agent.organizationId);

  // Emit typing indicator
  io.to(`conversation:${id}`).emit('agent:typing', { conversationId: id });

  try {
    // Process message with agent engine
    const response = await agentEngine.processMessage({
      agent: conversation.agent,
      conversation,
      history: conversation.messages.reverse(), // Chronological order
      userInput: content,
      metadata,
    });

    // Emit response
    io.to(`conversation:${id}`).emit('message:new', {
      conversationId: id,
      message: {
        role: 'ASSISTANT',
        content: response.content,
        metadata: response.metadata,
        createdAt: new Date(),
      },
    });

    res.json({
      success: true,
      data: {
        response: response.content,
        confidence: response.confidence,
        suggestedActions: response.suggestedActions,
        metadata: response.metadata,
      },
    });
  } catch (error) {
    logger.error('Message processing failed:', error);
    
    // Emit error
    io.to(`conversation:${id}`).emit('agent:error', {
      conversationId: id,
      error: 'Failed to process message',
    });

    throw new AppError('Failed to process message', 500);
  }
}));

/**
 * @route PUT /api/conversations/:id/end
 * @desc End a conversation
 * @access Private
 */
router.put('/:id/end', [
  param('id').isUUID(),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError('Invalid conversation ID', 400);
  }

  const { id } = req.params;

  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: {
      agent: {
        select: {
          organizationId: true,
        },
      },
    },
  });

  if (!conversation) {
    throw new AppError('Conversation not found', 404);
  }

  // Check permissions
  await checkPermission(req.user, 'update', 'conversation', conversation.agent.organizationId);

  // Update conversation
  const updatedConversation = await prisma.conversation.update({
    where: { id },
    data: {
      status: 'ENDED',
      endedAt: new Date(),
    },
  });

  // Calculate conversation metrics
  const messages = await prisma.message.findMany({
    where: { conversationId: id },
  });

  const duration = updatedConversation.endedAt!.getTime() - updatedConversation.startedAt.getTime();
  const messageCount = messages.length;
  const avgResponseTime = calculateAvgResponseTime(messages);

  logger.info(`Conversation ended: ${id}, duration: ${duration}ms, messages: ${messageCount}`);

  // Emit event
  io.to(`conversation:${id}`).emit('conversation:ended', {
    conversationId: id,
    duration,
    messageCount,
  });

  res.json({
    success: true,
    message: 'Conversation ended',
    data: {
      conversation: updatedConversation,
      metrics: {
        duration,
        messageCount,
        avgResponseTime,
      },
    },
  });
}));

/**
 * @route PUT /api/conversations/:id/transfer
 * @desc Transfer conversation to human agent
 * @access Private
 */
router.put('/:id/transfer', [
  param('id').isUUID(),
  body('reason').optional(),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError('Invalid conversation ID', 400);
  }

  const { id } = req.params;
  const { reason } = req.body;

  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: {
      agent: {
        select: {
          name: true,
          organizationId: true,
        },
      },
    },
  });

  if (!conversation) {
    throw new AppError('Conversation not found', 404);
  }

  // Check permissions
  await checkPermission(req.user, 'update', 'conversation', conversation.agent.organizationId);

  // Update conversation status
  const updatedConversation = await prisma.conversation.update({
    where: { id },
    data: {
      status: 'TRANSFERRED',
      metadata: {
        ...conversation.metadata,
        transferredAt: new Date(),
        transferredBy: req.user.id,
        transferReason: reason,
      },
    },
  });

  // Create system message
  await prisma.message.create({
    data: {
      conversationId: id,
      role: 'SYSTEM',
      content: `השיחה הועברה לנציג אנושי${reason ? `: ${reason}` : ''}`,
      metadata: {
        transferredBy: req.user.email,
      },
    },
  });

  logger.info(`Conversation transferred: ${id} by user: ${req.user.email}`);

  // Emit event
  io.to(`org:${conversation.agent.organizationId}`).emit('conversation:transferred', {
    conversationId: id,
    agentName: conversation.agent.name,
    reason,
  });

  res.json({
    success: true,
    message: 'Conversation transferred to human agent',
    data: { conversation: updatedConversation },
  });
}));

// Helper functions
async function analyzeConversationSentiment(messages: any[]) {
  const userMessages = messages.filter(m => m.role === 'USER');
  
  if (userMessages.length === 0) {
    return { overall: 'neutral', score: 0, breakdown: [] };
  }

  const sentiments = await Promise.all(
    userMessages.map(async (msg) => {
      const analysis = await hebrewNLP.analyzeText(msg.content);
      return {
        messageId: msg.id,
        sentiment: analysis.sentiment,
        timestamp: msg.createdAt,
      };
    })
  );

  // Calculate overall sentiment
  const avgScore = sentiments.reduce((sum, s) => sum + s.sentiment.score, 0) / sentiments.length;
  const overall = avgScore > 0.2 ? 'positive' : avgScore < -0.2 ? 'negative' : 'neutral';

  return {
    overall,
    score: avgScore,
    breakdown: sentiments,
  };
}

function calculateAvgResponseTime(messages: any[]): number {
  const responseTimes: number[] = [];
  
  for (let i = 1; i < messages.length; i++) {
    if (messages[i].role === 'ASSISTANT' && messages[i - 1].role === 'USER') {
      const responseTime = new Date(messages[i].createdAt).getTime() - 
                          new Date(messages[i - 1].createdAt).getTime();
      responseTimes.push(responseTime);
    }
  }

  if (responseTimes.length === 0) return 0;
  
  return responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
}

export default router;