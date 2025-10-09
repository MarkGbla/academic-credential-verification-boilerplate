import { UserRole } from '../types/user';

export const ROLE_PERMISSIONS = {
  [UserRole.STUDENT]: {
    canRead: ['own_credentials', 'own_profile', 'attestation_requests'],
    canWrite: ['own_profile', 'attestation_requests'],
    canDelete: ['own_profile'],
    description: 'Students can view their credentials and request government accreditation',
  },
  
  [UserRole.UNIVERSITY]: {
    canRead: ['own_credentials', 'own_students', 'own_profile', 'credential_stats'],
    canWrite: ['credentials', 'own_profile', 'student_credentials'],
    canDelete: ['own_credentials', 'own_profile'],
    description: 'Universities can issue credentials and manage their student records',
  },
  
  [UserRole.GOVERNMENT]: {
    canRead: ['pending_attestations', 'all_attestations', 'own_profile', 'verification_stats'],
    canWrite: ['attestations', 'own_profile', 'accreditations'],
    canDelete: ['own_profile'],
    description: 'Government entities can approve/reject attestation requests and accredit credentials',
  },
  
  [UserRole.EMPLOYER]: {
    canRead: ['public_verification', 'credential_verification'],
    canWrite: [],
    canDelete: [],
    description: 'Employers can only verify credentials (read-only access)',
  },
} as const;

export function getRolePermissions(role: UserRole) {
  return ROLE_PERMISSIONS[role];
}

export function canUserPerformAction(
  role: UserRole,
  action: 'read' | 'write' | 'delete',
  resource: string
): boolean {
  const permissions = getRolePermissions(role);
  
  switch (action) {
    case 'read':
      return permissions.canRead.includes(resource);
    case 'write':
      return permissions.canWrite.includes(resource);
    case 'delete':
      return permissions.canDelete.includes(resource);
    default:
      return false;
  }
}

export const ROLE_DISPLAY_NAMES = {
  [UserRole.STUDENT]: 'Student',
  [UserRole.UNIVERSITY]: 'University',
  [UserRole.GOVERNMENT]: 'Government Entity',
  [UserRole.EMPLOYER]: 'Employer',
} as const;

export const ROLE_DESCRIPTIONS = {
  [UserRole.STUDENT]: 'Access your academic credentials and request government verification',
  [UserRole.UNIVERSITY]: 'Issue digital credentials to students and manage academic records',
  [UserRole.GOVERNMENT]: 'Review and approve credential accreditation requests',
  [UserRole.EMPLOYER]: 'Verify the authenticity of academic credentials',
} as const;

export function getRoleDisplayName(role: UserRole): string {
  return ROLE_DISPLAY_NAMES[role];
}

export function getRoleDescription(role: UserRole): string {
  return ROLE_DESCRIPTIONS[role];
}

export function getAllRoles(): UserRole[] {
  return Object.values(UserRole);
}

export function isValidRole(role: string): role is UserRole {
  return Object.values(UserRole).includes(role as UserRole);
}