import { NextRequest, NextResponse } from 'next/server';
import { PrivyApi } from '@privy-io/server-auth';
import { UserRole } from '../types/user';
import { privyServerConfig } from './privy-config';

const privy = new PrivyApi(privyServerConfig.appId, privyServerConfig.appSecret);

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  entityId: string; // University ID, Student ID, or Government ID
  privyUserId: string;
}

/**
 * Middleware to authenticate requests using Privy tokens
 */
export async function withAuth(
  request: NextRequest,
  requiredRole?: UserRole
): Promise<{
  user: AuthenticatedUser;
  response?: NextResponse;
}> {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      user: null as any,
      response: new NextResponse('Missing authorization header', { status: 401 }),
    };
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    // Verify the Privy access token
    const user = await privy.verifyAuthToken(token);
    
    if (!user) {
      return {
        user: null as any,
        response: new NextResponse('Invalid token', { status: 401 }),
      };
    }

    // Get user metadata from Privy (role and entity information)
    const userMetadata = user.customMetadata as {
      role?: UserRole;
      entityId?: string;
    };

    if (!userMetadata.role || !userMetadata.entityId) {
      return {
        user: null as any,
        response: new NextResponse('User metadata incomplete', { status: 401 }),
      };
    }

    // Check role authorization
    if (requiredRole && userMetadata.role !== requiredRole) {
      return {
        user: null as any,
        response: new NextResponse('Insufficient permissions', { status: 403 }),
      };
    }

    const authenticatedUser: AuthenticatedUser = {
      id: userMetadata.entityId,
      email: user.email?.address || '',
      role: userMetadata.role,
      entityId: userMetadata.entityId,
      privyUserId: user.id,
    };

    return { user: authenticatedUser };
  } catch (error) {
    console.error('Authentication error:', error);
    return {
      user: null as any,
      response: new NextResponse('Authentication failed', { status: 401 }),
    };
  }
}

/**
 * Check if user has permission to access resource
 */
export function hasPermission(
  user: AuthenticatedUser,
  resource: {
    type: 'credential' | 'student' | 'university' | 'government' | 'attestation';
    ownerId?: string;
    universityId?: string;
    studentId?: string;
    governmentId?: string;
  }
): boolean {
  switch (user.role) {
    case UserRole.STUDENT:
      // Students can only access their own resources
      return resource.studentId === user.entityId || resource.ownerId === user.entityId;
      
    case UserRole.UNIVERSITY:
      // Universities can access their own resources and their students' credentials
      return resource.universityId === user.entityId || resource.ownerId === user.entityId;
      
    case UserRole.GOVERNMENT:
      // Government can access resources in their jurisdiction (simplified for now)
      return resource.governmentId === user.entityId || resource.ownerId === user.entityId;
      
    case UserRole.EMPLOYER:
      // Employers can only verify (read-only access to public verification)
      return resource.type === 'credential'; // Limited read access for verification
      
    default:
      return false;
  }
}

/**
 * Role-based middleware factory
 */
export function requireRole(role: UserRole) {
  return async (request: NextRequest) => {
    return withAuth(request, role);
  };
}

/**
 * Extract user from request (for use in API routes)
 */
export async function getUserFromRequest(request: NextRequest): Promise<AuthenticatedUser | null> {
  const { user, response } = await withAuth(request);
  
  if (response) {
    // Authentication failed
    return null;
  }
  
  return user;
}