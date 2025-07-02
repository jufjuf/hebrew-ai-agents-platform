import { AppError } from './errorHandler';
import { prisma } from '../database/connection';

type Resource = 'agent' | 'conversation' | 'integration' | 'analytics' | 'organization';
type Action = 'create' | 'read' | 'update' | 'delete';

interface User {
  id: string;
  email: string;
  role: string;
  organizationIds: string[];
}

/**
 * Check if user has permission to perform action on resource
 */
export async function checkPermission(
  user: User,
  action: Action,
  resource: Resource,
  resourceOrgId?: string
): Promise<boolean> {
  // System admins have all permissions
  if (user.role === 'ADMIN') {
    return true;
  }

  // If resource belongs to an organization, check if user belongs to it
  if (resourceOrgId) {
    const userOrg = await prisma.userOrganization.findFirst({
      where: {
        userId: user.id,
        organizationId: resourceOrgId,
      },
    });

    if (!userOrg) {
      throw new AppError('Access denied', 403);
    }

    // Check role-based permissions within organization
    const hasPermission = checkOrgRolePermission(userOrg.role, action, resource);
    if (!hasPermission) {
      throw new AppError('Insufficient permissions', 403);
    }
  }

  return true;
}

/**
 * Check organization role permissions
 */
function checkOrgRolePermission(
  role: string,
  action: Action,
  resource: Resource
): boolean {
  const permissions: Record<string, Record<Resource, Action[]>> = {
    OWNER: {
      agent: ['create', 'read', 'update', 'delete'],
      conversation: ['create', 'read', 'update', 'delete'],
      integration: ['create', 'read', 'update', 'delete'],
      analytics: ['read'],
      organization: ['read', 'update', 'delete'],
    },
    ADMIN: {
      agent: ['create', 'read', 'update', 'delete'],
      conversation: ['create', 'read', 'update', 'delete'],
      integration: ['create', 'read', 'update', 'delete'],
      analytics: ['read'],
      organization: ['read', 'update'],
    },
    MEMBER: {
      agent: ['create', 'read', 'update'],
      conversation: ['create', 'read', 'update'],
      integration: ['read'],
      analytics: ['read'],
      organization: ['read'],
    },
    VIEWER: {
      agent: ['read'],
      conversation: ['read'],
      integration: ['read'],
      analytics: ['read'],
      organization: ['read'],
    },
  };

  const rolePermissions = permissions[role];
  if (!rolePermissions) {
    return false;
  }

  const resourcePermissions = rolePermissions[resource];
  if (!resourcePermissions) {
    return false;
  }

  return resourcePermissions.includes(action);
}

/**
 * Middleware to check permissions
 */
export function requirePermission(action: Action, resource: Resource) {
  return async (req: any, res: any, next: any) => {
    try {
      const resourceOrgId = req.body.organizationId || 
                           req.query.organizationId || 
                           req.params.organizationId;

      await checkPermission(req.user, action, resource, resourceOrgId);
      next();
    } catch (error) {
      next(error);
    }
  };
}