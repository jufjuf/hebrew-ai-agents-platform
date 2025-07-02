import { Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import { prisma } from '../database/connection';
import { asyncHandler } from '../middleware/errorHandler';
import { AppError } from '../middleware/errorHandler';
import { authMiddleware } from '../middleware/auth';
import { checkPermission } from '../middleware/permissions';
import { logger } from '../utils/logger';
import { encryptData, decryptData } from '../utils/encryption';

const router = Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Available integrations configuration
const AVAILABLE_INTEGRATIONS = [
  {
    id: 'whatsapp',
    name: 'WhatsApp Business',
    category: 'messaging',
    icon: 'whatsapp',
    requiredFields: ['accessToken', 'phoneNumberId'],
    optionalFields: ['webhookVerifyToken'],
  },
  {
    id: 'telegram',
    name: 'Telegram',
    category: 'messaging',
    icon: 'telegram',
    requiredFields: ['botToken'],
    optionalFields: ['webhookUrl'],
  },
  {
    id: 'slack',
    name: 'Slack',
    category: 'messaging',
    icon: 'slack',
    requiredFields: ['botToken', 'appToken'],
    optionalFields: ['signingSecret'],
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    category: 'crm',
    icon: 'hubspot',
    requiredFields: ['apiKey'],
    optionalFields: ['portalId'],
  },
  {
    id: 'salesforce',
    name: 'Salesforce',
    category: 'crm',
    icon: 'salesforce',
    requiredFields: ['clientId', 'clientSecret', 'refreshToken'],
    optionalFields: ['instanceUrl'],
  },
  {
    id: 'tranzila',
    name: 'Tranzila',
    category: 'payment',
    icon: 'payment',
    requiredFields: ['terminalName', 'terminalPassword'],
    optionalFields: ['currency'],
  },
  {
    id: 'cardcom',
    name: 'Cardcom',
    category: 'payment',
    icon: 'payment',
    requiredFields: ['terminalNumber', 'userName', 'apiName', 'apiPassword'],
    optionalFields: [],
  },
];

/**
 * @route GET /api/integrations/available
 * @desc Get list of available integrations
 * @access Private
 */
router.get('/available', asyncHandler(async (req, res) => {
  const { category } = req.query;

  let integrations = AVAILABLE_INTEGRATIONS;

  if (category) {
    integrations = integrations.filter(int => int.category === category);
  }

  res.json({
    success: true,
    data: { integrations },
  });
}));

/**
 * @route GET /api/integrations
 * @desc Get connected integrations for organization
 * @access Private
 */
router.get('/', asyncHandler(async (req, res) => {
  const { organizationId } = req.query;

  if (!organizationId) {
    throw new AppError('Organization ID required', 400);
  }

  // Check permissions
  await checkPermission(req.user, 'read', 'integration', organizationId as string);

  const integrations = await prisma.integration.findMany({
    where: {
      organizationId: organizationId as string,
      isActive: true,
    },
  });

  // Decrypt sensitive data and hide it
  const sanitizedIntegrations = integrations.map(int => {
    const config = int.configuration as any;
    const sanitizedConfig: any = {};

    // Show only non-sensitive fields
    Object.keys(config).forEach(key => {
      if (key.includes('Token') || key.includes('Secret') || key.includes('Password') || key.includes('Key')) {
        sanitizedConfig[key] = '••••••••';
      } else {
        sanitizedConfig[key] = config[key];
      }
    });

    return {
      ...int,
      configuration: sanitizedConfig,
    };
  });

  res.json({
    success: true,
    data: { integrations: sanitizedIntegrations },
  });
}));

/**
 * @route GET /api/integrations/:id
 * @desc Get integration details
 * @access Private
 */
router.get('/:id', [
  param('id').isUUID(),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError('Invalid integration ID', 400);
  }

  const { id } = req.params;

  const integration = await prisma.integration.findUnique({
    where: { id },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!integration) {
    throw new AppError('Integration not found', 404);
  }

  // Check permissions
  await checkPermission(req.user, 'read', 'integration', integration.organizationId);

  // Sanitize configuration
  const config = integration.configuration as any;
  const sanitizedConfig: any = {};

  Object.keys(config).forEach(key => {
    if (key.includes('Token') || key.includes('Secret') || key.includes('Password') || key.includes('Key')) {
      sanitizedConfig[key] = '••••••••';
    } else {
      sanitizedConfig[key] = config[key];
    }
  });

  res.json({
    success: true,
    data: {
      integration: {
        ...integration,
        configuration: sanitizedConfig,
      },
    },
  });
}));

/**
 * @route POST /api/integrations
 * @desc Connect a new integration
 * @access Private
 */
router.post('/', [
  body('type').notEmpty().isIn(AVAILABLE_INTEGRATIONS.map(i => i.id)),
  body('name').notEmpty().trim(),
  body('organizationId').isUUID(),
  body('configuration').isObject(),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError('Validation failed', 400);
  }

  const { type, name, organizationId, configuration } = req.body;

  // Check permissions
  await checkPermission(req.user, 'create', 'integration', organizationId);

  // Validate required fields
  const integrationDef = AVAILABLE_INTEGRATIONS.find(i => i.id === type);
  if (!integrationDef) {
    throw new AppError('Invalid integration type', 400);
  }

  for (const field of integrationDef.requiredFields) {
    if (!configuration[field]) {
      throw new AppError(`Missing required field: ${field}`, 400);
    }
  }

  // Encrypt sensitive data
  const encryptedConfig: any = {};
  Object.keys(configuration).forEach(key => {
    if (key.includes('Token') || key.includes('Secret') || key.includes('Password') || key.includes('Key')) {
      encryptedConfig[key] = encryptData(configuration[key]);
    } else {
      encryptedConfig[key] = configuration[key];
    }
  });

  // Test connection before saving
  try {
    await testIntegrationConnection(type, configuration);
  } catch (error) {
    logger.error(`Integration test failed for ${type}:`, error);
    throw new AppError('Failed to connect to integration. Please check your credentials.', 400);
  }

  // Create integration
  const integration = await prisma.integration.create({
    data: {
      type,
      name,
      organizationId,
      configuration: encryptedConfig,
    },
  });

  logger.info(`Integration created: ${integration.id} (${type}) for org: ${organizationId}`);

  res.status(201).json({
    success: true,
    message: 'Integration connected successfully',
    data: {
      integration: {
        id: integration.id,
        type: integration.type,
        name: integration.name,
        isActive: integration.isActive,
        createdAt: integration.createdAt,
      },
    },
  });
}));

/**
 * @route PUT /api/integrations/:id
 * @desc Update integration configuration
 * @access Private
 */
router.put('/:id', [
  param('id').isUUID(),
  body('name').optional().trim(),
  body('configuration').optional().isObject(),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError('Validation failed', 400);
  }

  const { id } = req.params;
  const { name, configuration } = req.body;

  const integration = await prisma.integration.findUnique({
    where: { id },
  });

  if (!integration) {
    throw new AppError('Integration not found', 404);
  }

  // Check permissions
  await checkPermission(req.user, 'update', 'integration', integration.organizationId);

  const updateData: any = {};

  if (name) {
    updateData.name = name;
  }

  if (configuration) {
    // Merge with existing configuration
    const existingConfig = integration.configuration as any;
    const decryptedConfig: any = {};

    // Decrypt existing sensitive data
    Object.keys(existingConfig).forEach(key => {
      if (key.includes('Token') || key.includes('Secret') || key.includes('Password') || key.includes('Key')) {
        decryptedConfig[key] = decryptData(existingConfig[key]);
      } else {
        decryptedConfig[key] = existingConfig[key];
      }
    });

    // Merge with new configuration
    const mergedConfig = { ...decryptedConfig, ...configuration };

    // Test connection with new configuration
    try {
      await testIntegrationConnection(integration.type, mergedConfig);
    } catch (error) {
      logger.error(`Integration test failed for ${integration.type}:`, error);
      throw new AppError('Failed to connect with new configuration', 400);
    }

    // Encrypt sensitive data again
    const encryptedConfig: any = {};
    Object.keys(mergedConfig).forEach(key => {
      if (key.includes('Token') || key.includes('Secret') || key.includes('Password') || key.includes('Key')) {
        encryptedConfig[key] = encryptData(mergedConfig[key]);
      } else {
        encryptedConfig[key] = mergedConfig[key];
      }
    });

    updateData.configuration = encryptedConfig;
  }

  const updatedIntegration = await prisma.integration.update({
    where: { id },
    data: updateData,
  });

  logger.info(`Integration updated: ${id}`);

  res.json({
    success: true,
    message: 'Integration updated successfully',
    data: {
      integration: {
        id: updatedIntegration.id,
        type: updatedIntegration.type,
        name: updatedIntegration.name,
        isActive: updatedIntegration.isActive,
        updatedAt: updatedIntegration.updatedAt,
      },
    },
  });
}));

/**
 * @route DELETE /api/integrations/:id
 * @desc Disconnect integration
 * @access Private
 */
router.delete('/:id', [
  param('id').isUUID(),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError('Invalid integration ID', 400);
  }

  const { id } = req.params;

  const integration = await prisma.integration.findUnique({
    where: { id },
  });

  if (!integration) {
    throw new AppError('Integration not found', 404);
  }

  // Check permissions
  await checkPermission(req.user, 'delete', 'integration', integration.organizationId);

  // Soft delete
  await prisma.integration.update({
    where: { id },
    data: { isActive: false },
  });

  logger.info(`Integration disconnected: ${id}`);

  res.json({
    success: true,
    message: 'Integration disconnected successfully',
  });
}));

/**
 * @route POST /api/integrations/:id/test
 * @desc Test integration connection
 * @access Private
 */
router.post('/:id/test', [
  param('id').isUUID(),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError('Invalid integration ID', 400);
  }

  const { id } = req.params;

  const integration = await prisma.integration.findUnique({
    where: { id },
  });

  if (!integration) {
    throw new AppError('Integration not found', 404);
  }

  // Check permissions
  await checkPermission(req.user, 'read', 'integration', integration.organizationId);

  // Decrypt configuration
  const config = integration.configuration as any;
  const decryptedConfig: any = {};

  Object.keys(config).forEach(key => {
    if (key.includes('Token') || key.includes('Secret') || key.includes('Password') || key.includes('Key')) {
      decryptedConfig[key] = decryptData(config[key]);
    } else {
      decryptedConfig[key] = config[key];
    }
  });

  try {
    const result = await testIntegrationConnection(integration.type, decryptedConfig);
    
    res.json({
      success: true,
      message: 'Integration test successful',
      data: result,
    });
  } catch (error: any) {
    throw new AppError(`Integration test failed: ${error.message}`, 400);
  }
}));

// Helper function to test integration connections
async function testIntegrationConnection(type: string, config: any): Promise<any> {
  switch (type) {
    case 'whatsapp':
      // Test WhatsApp Business API
      // In production, make actual API call
      return { status: 'connected', phoneNumber: config.phoneNumberId };

    case 'telegram':
      // Test Telegram Bot API
      // In production, make actual API call
      return { status: 'connected', botUsername: 'test_bot' };

    case 'slack':
      // Test Slack API
      // In production, make actual API call
      return { status: 'connected', workspace: 'Test Workspace' };

    case 'hubspot':
      // Test HubSpot API
      // In production, make actual API call
      return { status: 'connected', portalId: config.portalId };

    case 'salesforce':
      // Test Salesforce API
      // In production, make actual API call
      return { status: 'connected', instanceUrl: config.instanceUrl };

    case 'tranzila':
      // Test Tranzila API
      // In production, make actual API call
      return { status: 'connected', terminal: config.terminalName };

    case 'cardcom':
      // Test Cardcom API
      // In production, make actual API call
      return { status: 'connected', terminal: config.terminalNumber };

    default:
      throw new Error('Unknown integration type');
  }
}

export default router;