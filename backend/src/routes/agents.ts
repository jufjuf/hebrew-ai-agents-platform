import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { prisma } from '../database/connection';
import { asyncHandler } from '../middleware/errorHandler';
import { AppError } from '../middleware/errorHandler';
import { authMiddleware } from '../middleware/auth';
import { checkPermission } from '../middleware/permissions';
import { logger } from '../utils/logger';
import { cache } from '../services/redis';
import { agentEngine } from '../services/agent-engine';
import { io } from '../index';

const router = Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Validation rules
const createAgentValidation = [
  body('name').notEmpty().trim(),
  body('hebrewName').optional().trim(),
  body('description').optional().trim(),
  body('prompt').notEmpty(),
  body('model').isIn(['gpt-4', 'gpt-4-turbo-preview', 'gpt-3.5-turbo', 'claude-3-opus', 'claude-3-sonnet']),
  body('temperature').isFloat({ min: 0, max: 2 }).toFloat(),
  body('maxTokens').isInt({ min: 1, max: 200000 }).toInt(),
  body('language').isIn(['he', 'en', 'auto']).withMessage('Invalid language'),
];

/**
 * @route GET /api/agents
 * @desc Get all agents for the user's organization
 * @access Private
 */
router.get('/', asyncHandler(async (req, res) => {
  const { organizationId, search, isActive, page = 1, limit = 20 } = req.query;

  // Build query filters
  const where: any = {};
  
  if (organizationId) {
    where.organizationId = organizationId as string;
  } else {
    // Get user's organizations
    const userOrgs = await prisma.userOrganization.findMany({
      where: { userId: req.user.id },
      select: { organizationId: true },
    });
    where.organizationId = { in: userOrgs.map(org => org.organizationId) };
  }

  if (search) {
    where.OR = [
      { name: { contains: search as string, mode: 'insensitive' } },
      { hebrewName: { contains: search as string, mode: 'insensitive' } },
      { description: { contains: search as string, mode: 'insensitive' } },
    ];
  }

  if (isActive !== undefined) {
    where.isActive = isActive === 'true';
  }

  // Calculate pagination
  const skip = (Number(page) - 1) * Number(limit);

  // Get agents with pagination
  const [agents, total] = await Promise.all([
    prisma.agent.findMany({
      where,
      include: {
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        _count: {
          select: {
            conversations: true,
            knowledgeBases: true,
            skills: true,
          },
        },
      },
      skip,
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
    }),
    prisma.agent.count({ where }),
  ]);

  res.json({
    success: true,
    data: {
      agents,
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
 * @route GET /api/agents/:id
 * @desc Get agent by ID
 * @access Private
 */
router.get('/:id', [
  param('id').isUUID(),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError('Invalid agent ID', 400);
  }

  const { id } = req.params;

  // Try to get from cache first
  const cacheKey = `agent:${id}`;
  const cachedAgent = await cache.get(cacheKey);
  
  if (cachedAgent) {
    return res.json({
      success: true,
      data: { agent: cachedAgent },
    });
  }

  const agent = await prisma.agent.findUnique({
    where: { id },
    include: {
      creator: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      organization: {
        select: {
          id: true,
          name: true,
        },
      },
      knowledgeBases: {
        include: {
          _count: {
            select: { documents: true },
          },
        },
      },
      skills: true,
      _count: {
        select: {
          conversations: true,
        },
      },
    },
  });

  if (!agent) {
    throw new AppError('Agent not found', 404);
  }

  // Check permissions
  await checkPermission(req.user, 'read', 'agent', agent.organizationId);

  // Cache the agent
  await cache.set(cacheKey, agent, 300); // 5 minutes

  res.json({
    success: true,
    data: { agent },
  });
}));

/**
 * @route POST /api/agents
 * @desc Create a new agent
 * @access Private
 */
router.post('/', createAgentValidation, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError('Validation failed', 400);
  }

  const {
    name,
    hebrewName,
    description,
    prompt,
    model,
    temperature,
    maxTokens,
    language,
    organizationId,
  } = req.body;

  // Check permissions
  await checkPermission(req.user, 'create', 'agent', organizationId);

  // Create agent
  const agent = await prisma.agent.create({
    data: {
      name,
      hebrewName,
      description,
      prompt,
      model,
      temperature,
      maxTokens,
      language,
      creatorId: req.user.id,
      organizationId,
    },
    include: {
      creator: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  logger.info(`Agent created: ${agent.id} by user: ${req.user.email}`);

  // Emit event
  io.to(`org:${organizationId}`).emit('agent:created', {
    agentId: agent.id,
    agentName: agent.name,
    createdBy: req.user.email,
  });

  res.status(201).json({
    success: true,
    message: 'Agent created successfully',
    data: { agent },
  });
}));

/**
 * @route PUT /api/agents/:id
 * @desc Update agent
 * @access Private
 */
router.put('/:id', [
  param('id').isUUID(),
  ...createAgentValidation,
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError('Validation failed', 400);
  }

  const { id } = req.params;
  const updateData = req.body;

  // Get existing agent
  const existingAgent = await prisma.agent.findUnique({
    where: { id },
  });

  if (!existingAgent) {
    throw new AppError('Agent not found', 404);
  }

  // Check permissions
  await checkPermission(req.user, 'update', 'agent', existingAgent.organizationId);

  // Update agent
  const agent = await prisma.agent.update({
    where: { id },
    data: updateData,
    include: {
      creator: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  // Clear cache
  await cache.del(`agent:${id}`);

  logger.info(`Agent updated: ${id} by user: ${req.user.email}`);

  // Emit event
  io.to(`org:${agent.organizationId}`).emit('agent:updated', {
    agentId: agent.id,
    agentName: agent.name,
    updatedBy: req.user.email,
  });

  res.json({
    success: true,
    message: 'Agent updated successfully',
    data: { agent },
  });
}));

/**
 * @route DELETE /api/agents/:id
 * @desc Delete agent
 * @access Private
 */
router.delete('/:id', [
  param('id').isUUID(),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError('Invalid agent ID', 400);
  }

  const { id } = req.params;

  // Get agent
  const agent = await prisma.agent.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          conversations: true,
        },
      },
    },
  });

  if (!agent) {
    throw new AppError('Agent not found', 404);
  }

  // Check permissions
  await checkPermission(req.user, 'delete', 'agent', agent.organizationId);

  // Check if agent has active conversations
  if (agent._count.conversations > 0) {
    throw new AppError('Cannot delete agent with existing conversations', 400);
  }

  // Soft delete
  await prisma.agent.update({
    where: { id },
    data: { isActive: false },
  });

  // Clear cache
  await cache.del(`agent:${id}`);

  logger.info(`Agent deleted: ${id} by user: ${req.user.email}`);

  // Emit event
  io.to(`org:${agent.organizationId}`).emit('agent:deleted', {
    agentId: agent.id,
    deletedBy: req.user.email,
  });

  res.json({
    success: true,
    message: 'Agent deleted successfully',
  });
}));

/**
 * @route POST /api/agents/:id/test
 * @desc Test agent with a message
 * @access Private
 */
router.post('/:id/test', [
  param('id').isUUID(),
  body('message').notEmpty(),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError('Validation failed', 400);
  }

  const { id } = req.params;
  const { message } = req.body;

  // Get agent
  const agent = await prisma.agent.findUnique({
    where: { id },
  });

  if (!agent || !agent.isActive) {
    throw new AppError('Agent not found or inactive', 404);
  }

  // Check permissions
  await checkPermission(req.user, 'read', 'agent', agent.organizationId);

  // Create test conversation
  const conversation = await prisma.conversation.create({
    data: {
      agentId: agent.id,
      userId: req.user.id,
      channel: 'test',
      metadata: {
        isTest: true,
      },
    },
  });

  try {
    // Process message
    const response = await agentEngine.processMessage({
      agent,
      conversation,
      history: [],
      userInput: message,
      metadata: {
        isTest: true,
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
    logger.error('Agent test failed:', error);
    throw new AppError('Failed to process test message', 500);
  } finally {
    // Clean up test conversation
    await prisma.conversation.delete({
      where: { id: conversation.id },
    });
  }
}));

/**
 * @route POST /api/agents/:id/duplicate
 * @desc Duplicate an agent
 * @access Private
 */
router.post('/:id/duplicate', [
  param('id').isUUID(),
  body('name').notEmpty().trim(),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError('Validation failed', 400);
  }

  const { id } = req.params;
  const { name } = req.body;

  // Get original agent
  const originalAgent = await prisma.agent.findUnique({
    where: { id },
    include: {
      knowledgeBases: true,
      skills: true,
    },
  });

  if (!originalAgent) {
    throw new AppError('Agent not found', 404);
  }

  // Check permissions
  await checkPermission(req.user, 'create', 'agent', originalAgent.organizationId);

  // Create duplicate in transaction
  const duplicatedAgent = await prisma.$transaction(async (tx) => {
    // Create new agent
    const newAgent = await tx.agent.create({
      data: {
        name,
        hebrewName: originalAgent.hebrewName ? `${originalAgent.hebrewName} - העתק` : undefined,
        description: originalAgent.description,
        prompt: originalAgent.prompt,
        model: originalAgent.model,
        temperature: originalAgent.temperature,
        maxTokens: originalAgent.maxTokens,
        language: originalAgent.language,
        creatorId: req.user.id,
        organizationId: originalAgent.organizationId,
      },
    });

    // Duplicate skills
    if (originalAgent.skills.length > 0) {
      await tx.agentSkill.createMany({
        data: originalAgent.skills.map(skill => ({
          agentId: newAgent.id,
          name: skill.name,
          description: skill.description,
          type: skill.type,
          configuration: skill.configuration,
        })),
      });
    }

    return newAgent;
  });

  logger.info(`Agent duplicated: ${id} -> ${duplicatedAgent.id} by user: ${req.user.email}`);

  res.status(201).json({
    success: true,
    message: 'Agent duplicated successfully',
    data: { agent: duplicatedAgent },
  });
}));

export default router;