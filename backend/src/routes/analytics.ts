import { Router } from 'express';
import { query, validationResult } from 'express-validator';
import { prisma } from '../database/connection';
import { asyncHandler } from '../middleware/errorHandler';
import { AppError } from '../middleware/errorHandler';
import { authMiddleware } from '../middleware/auth';
import { checkPermission } from '../middleware/permissions';
import { cache } from '../services/redis';
import dayjs from 'dayjs';

const router = Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

/**
 * @route GET /api/analytics/overview
 * @desc Get analytics overview
 * @access Private
 */
router.get('/overview', [
  query('organizationId').isUUID(),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError('Validation failed', 400);
  }

  const { organizationId, startDate, endDate } = req.query;

  // Check permissions
  await checkPermission(req.user, 'read', 'analytics', organizationId as string);

  // Set default date range (last 30 days)
  const end = endDate ? dayjs(endDate as string) : dayjs();
  const start = startDate ? dayjs(startDate as string) : end.subtract(30, 'days');

  // Try cache first
  const cacheKey = `analytics:overview:${organizationId}:${start.format('YYYY-MM-DD')}:${end.format('YYYY-MM-DD')}`;
  const cached = await cache.get(cacheKey);
  if (cached) {
    return res.json({ success: true, data: cached });
  }

  // Get organization's agents
  const agents = await prisma.agent.findMany({
    where: { organizationId: organizationId as string },
    select: { id: true },
  });
  const agentIds = agents.map(a => a.id);

  // Aggregate data
  const [conversations, messages, agents_count, activeConversations] = await Promise.all([
    // Total conversations
    prisma.conversation.count({
      where: {
        agentId: { in: agentIds },
        startedAt: {
          gte: start.toDate(),
          lte: end.toDate(),
        },
      },
    }),
    // Total messages
    prisma.message.count({
      where: {
        conversation: {
          agentId: { in: agentIds },
        },
        createdAt: {
          gte: start.toDate(),
          lte: end.toDate(),
        },
      },
    }),
    // Active agents
    prisma.agent.count({
      where: {
        organizationId: organizationId as string,
        isActive: true,
      },
    }),
    // Currently active conversations
    prisma.conversation.count({
      where: {
        agentId: { in: agentIds },
        status: 'ACTIVE',
      },
    }),
  ]);

  // Calculate average response times
  const responseTimeData = await prisma.$queryRaw<any[]>`
    SELECT 
      AVG(EXTRACT(EPOCH FROM (m2."created_at" - m1."created_at"))) as avg_response_time
    FROM messages m1
    JOIN messages m2 ON m2."conversation_id" = m1."conversation_id"
    WHERE m1.role = 'USER' 
      AND m2.role = 'ASSISTANT'
      AND m2."created_at" > m1."created_at"
      AND m1."conversation_id" IN (
        SELECT id FROM conversations 
        WHERE "agent_id" = ANY(${agentIds})
      )
      AND m1."created_at" >= ${start.toDate()}
      AND m1."created_at" <= ${end.toDate()}
  `;

  const avgResponseTime = responseTimeData[0]?.avg_response_time || 0;

  // Calculate satisfaction metrics (based on sentiment)
  const sentimentData = await prisma.$queryRaw<any[]>`
    SELECT 
      COUNT(CASE WHEN metadata->>'sentiment' = 'positive' THEN 1 END) as positive,
      COUNT(CASE WHEN metadata->>'sentiment' = 'negative' THEN 1 END) as negative,
      COUNT(CASE WHEN metadata->>'sentiment' = 'neutral' THEN 1 END) as neutral
    FROM messages
    WHERE role = 'USER'
      AND "conversation_id" IN (
        SELECT id FROM conversations 
        WHERE "agent_id" = ANY(${agentIds})
      )
      AND "created_at" >= ${start.toDate()}
      AND "created_at" <= ${end.toDate()}
  `;

  const totalSentiments = (sentimentData[0].positive || 0) + 
                         (sentimentData[0].negative || 0) + 
                         (sentimentData[0].neutral || 0);
  
  const satisfactionRate = totalSentiments > 0 
    ? ((sentimentData[0].positive || 0) / totalSentiments) * 100 
    : 0;

  // Calculate resolution rate
  const resolvedConversations = await prisma.conversation.count({
    where: {
      agentId: { in: agentIds },
      status: 'ENDED',
      metadata: {
        path: ['resolved'],
        equals: true,
      },
      startedAt: {
        gte: start.toDate(),
        lte: end.toDate(),
      },
    },
  });

  const resolutionRate = conversations > 0 
    ? (resolvedConversations / conversations) * 100 
    : 0;

  const overview = {
    totalConversations: conversations,
    totalMessages: messages,
    activeAgents: agents_count,
    activeConversations,
    avgResponseTime: Math.round(avgResponseTime * 1000), // Convert to milliseconds
    satisfactionRate: Math.round(satisfactionRate * 10) / 10,
    resolutionRate: Math.round(resolutionRate * 10) / 10,
    sentiment: sentimentData[0],
    dateRange: {
      start: start.format('YYYY-MM-DD'),
      end: end.format('YYYY-MM-DD'),
    },
  };

  // Cache for 1 hour
  await cache.set(cacheKey, overview, 3600);

  res.json({
    success: true,
    data: overview,
  });
}));

/**
 * @route GET /api/analytics/conversations
 * @desc Get conversation analytics
 * @access Private
 */
router.get('/conversations', [
  query('organizationId').isUUID(),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  query('groupBy').optional().isIn(['day', 'week', 'month']),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError('Validation failed', 400);
  }

  const { organizationId, startDate, endDate, groupBy = 'day' } = req.query;

  // Check permissions
  await checkPermission(req.user, 'read', 'analytics', organizationId as string);

  const end = endDate ? dayjs(endDate as string) : dayjs();
  const start = startDate ? dayjs(startDate as string) : end.subtract(30, 'days');

  // Get organization's agents
  const agents = await prisma.agent.findMany({
    where: { organizationId: organizationId as string },
    select: { id: true },
  });
  const agentIds = agents.map(a => a.id);

  // Get conversation data grouped by period
  let dateFormat: string;
  switch (groupBy) {
    case 'month':
      dateFormat = 'YYYY-MM';
      break;
    case 'week':
      dateFormat = 'YYYY-[W]WW';
      break;
    default:
      dateFormat = 'YYYY-MM-DD';
  }

  const conversationData = await prisma.$queryRaw<any[]>`
    SELECT 
      TO_CHAR("started_at", '${dateFormat}') as period,
      COUNT(*) as total,
      COUNT(CASE WHEN status = 'ENDED' THEN 1 END) as completed,
      COUNT(CASE WHEN status = 'TRANSFERRED' THEN 1 END) as transferred,
      AVG(CASE 
        WHEN "ended_at" IS NOT NULL 
        THEN EXTRACT(EPOCH FROM ("ended_at" - "started_at")) 
        ELSE NULL 
      END) as avg_duration
    FROM conversations
    WHERE "agent_id" = ANY(${agentIds})
      AND "started_at" >= ${start.toDate()}
      AND "started_at" <= ${end.toDate()}
    GROUP BY period
    ORDER BY period
  `;

  // Get message volume
  const messageVolume = await prisma.$queryRaw<any[]>`
    SELECT 
      TO_CHAR(m."created_at", '${dateFormat}') as period,
      COUNT(*) as total_messages,
      COUNT(CASE WHEN m.role = 'USER' THEN 1 END) as user_messages,
      COUNT(CASE WHEN m.role = 'ASSISTANT' THEN 1 END) as assistant_messages
    FROM messages m
    JOIN conversations c ON c.id = m."conversation_id"
    WHERE c."agent_id" = ANY(${agentIds})
      AND m."created_at" >= ${start.toDate()}
      AND m."created_at" <= ${end.toDate()}
    GROUP BY period
    ORDER BY period
  `;

  // Combine data
  const combinedData = conversationData.map(conv => {
    const msgData = messageVolume.find(m => m.period === conv.period) || {
      total_messages: 0,
      user_messages: 0,
      assistant_messages: 0,
    };

    return {
      period: conv.period,
      conversations: {
        total: parseInt(conv.total),
        completed: parseInt(conv.completed),
        transferred: parseInt(conv.transferred),
        avgDuration: conv.avg_duration ? Math.round(conv.avg_duration) : 0,
      },
      messages: {
        total: parseInt(msgData.total_messages),
        user: parseInt(msgData.user_messages),
        assistant: parseInt(msgData.assistant_messages),
      },
    };
  });

  res.json({
    success: true,
    data: {
      analytics: combinedData,
      summary: {
        totalConversations: conversationData.reduce((sum, d) => sum + parseInt(d.total), 0),
        totalMessages: messageVolume.reduce((sum, d) => sum + parseInt(d.total_messages), 0),
        avgConversationsPerPeriod: Math.round(
          conversationData.reduce((sum, d) => sum + parseInt(d.total), 0) / conversationData.length
        ),
      },
    },
  });
}));

/**
 * @route GET /api/analytics/agents
 * @desc Get agent performance analytics
 * @access Private
 */
router.get('/agents', [
  query('organizationId').isUUID(),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError('Validation failed', 400);
  }

  const { organizationId, startDate, endDate } = req.query;

  // Check permissions
  await checkPermission(req.user, 'read', 'analytics', organizationId as string);

  const end = endDate ? dayjs(endDate as string) : dayjs();
  const start = startDate ? dayjs(startDate as string) : end.subtract(30, 'days');

  // Get agent performance data
  const agentPerformance = await prisma.$queryRaw<any[]>`
    SELECT 
      a.id,
      a.name,
      a."hebrew_name",
      COUNT(DISTINCT c.id) as total_conversations,
      COUNT(DISTINCT m.id) as total_messages,
      AVG(CASE 
        WHEN c."ended_at" IS NOT NULL 
        THEN EXTRACT(EPOCH FROM (c."ended_at" - c."started_at")) 
        ELSE NULL 
      END) as avg_conversation_duration,
      COUNT(DISTINCT CASE WHEN c.status = 'TRANSFERRED' THEN c.id END) as transferred_conversations,
      COUNT(DISTINCT CASE 
        WHEN c.metadata->>'resolved' = 'true' 
        THEN c.id 
      END) as resolved_conversations
    FROM agents a
    LEFT JOIN conversations c ON c."agent_id" = a.id 
      AND c."started_at" >= ${start.toDate()}
      AND c."started_at" <= ${end.toDate()}
    LEFT JOIN messages m ON m."conversation_id" = c.id
    WHERE a."organization_id" = ${organizationId}
      AND a."is_active" = true
    GROUP BY a.id, a.name, a."hebrew_name"
    ORDER BY total_conversations DESC
  `;

  // Calculate additional metrics
  const enhancedPerformance = agentPerformance.map(agent => {
    const totalConv = parseInt(agent.total_conversations) || 0;
    const transferredConv = parseInt(agent.transferred_conversations) || 0;
    const resolvedConv = parseInt(agent.resolved_conversations) || 0;

    return {
      id: agent.id,
      name: agent.name,
      hebrewName: agent.hebrew_name,
      metrics: {
        totalConversations: totalConv,
        totalMessages: parseInt(agent.total_messages) || 0,
        avgConversationDuration: agent.avg_conversation_duration 
          ? Math.round(agent.avg_conversation_duration) 
          : 0,
        transferRate: totalConv > 0 
          ? Math.round((transferredConv / totalConv) * 100 * 10) / 10 
          : 0,
        resolutionRate: totalConv > 0 
          ? Math.round((resolvedConv / totalConv) * 100 * 10) / 10 
          : 0,
        avgMessagesPerConversation: totalConv > 0 
          ? Math.round((parseInt(agent.total_messages) / totalConv) * 10) / 10 
          : 0,
      },
    };
  });

  res.json({
    success: true,
    data: {
      agents: enhancedPerformance,
      dateRange: {
        start: start.format('YYYY-MM-DD'),
        end: end.format('YYYY-MM-DD'),
      },
    },
  });
}));

/**
 * @route GET /api/analytics/topics
 * @desc Get popular conversation topics
 * @access Private
 */
router.get('/topics', [
  query('organizationId').isUUID(),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  query('limit').optional().isInt({ min: 1, max: 50 }),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError('Validation failed', 400);
  }

  const { organizationId, startDate, endDate, limit = 20 } = req.query;

  // Check permissions
  await checkPermission(req.user, 'read', 'analytics', organizationId as string);

  const end = endDate ? dayjs(endDate as string) : dayjs();
  const start = startDate ? dayjs(startDate as string) : end.subtract(30, 'days');

  // Get organization's agents
  const agents = await prisma.agent.findMany({
    where: { organizationId: organizationId as string },
    select: { id: true },
  });
  const agentIds = agents.map(a => a.id);

  // In production, this would use NLP to extract topics
  // For now, we'll use a simplified approach
  const topics = await prisma.$queryRaw<any[]>`
    SELECT 
      metadata->>'topic' as topic,
      COUNT(*) as count
    FROM conversations
    WHERE "agent_id" = ANY(${agentIds})
      AND "started_at" >= ${start.toDate()}
      AND "started_at" <= ${end.toDate()}
      AND metadata->>'topic' IS NOT NULL
    GROUP BY topic
    ORDER BY count DESC
    LIMIT ${parseInt(limit as string)}
  `;

  res.json({
    success: true,
    data: {
      topics: topics.map(t => ({
        topic: t.topic,
        count: parseInt(t.count),
      })),
      dateRange: {
        start: start.format('YYYY-MM-DD'),
        end: end.format('YYYY-MM-DD'),
      },
    },
  });
}));

export default router;