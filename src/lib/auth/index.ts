// Authentication configuration
export { privyConfig, privyServerConfig } from './privy-config';

// Authentication middleware
export { 
  withAuth, 
  hasPermission, 
  requireRole, 
  getUserFromRequest,
  type AuthenticatedUser 
} from './middleware';

// Role-based access control
export {
  ROLE_PERMISSIONS,
  ROLE_DISPLAY_NAMES,
  ROLE_DESCRIPTIONS,
  getRolePermissions,
  canUserPerformAction,
  getRoleDisplayName,
  getRoleDescription,
  getAllRoles,
  isValidRole,
} from './roles';