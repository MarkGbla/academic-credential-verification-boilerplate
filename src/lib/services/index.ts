// Service implementations
export { StudentService } from './StudentService';
export { UniversityService } from './UniversityService';
export { GovernmentService } from './GovernmentService';
export { AttestationService } from './AttestationService';
export { VerificationService } from './VerificationService';
export { BlockchainService } from './BlockchainService';
export { NotificationService } from './NotificationService';
export { BatchVerificationService } from './BatchVerificationService';

// Service data types
export type { StudentData } from './StudentService';
export type { UniversityData } from './UniversityService';
export type { GovernmentData } from './GovernmentService';
export type { VerificationResult } from './VerificationService';
export type { BlockchainConfig, AttestationData } from './BlockchainService';
export type { EmailConfig, WebhookConfig, NotificationPayload } from './NotificationService';
export type { BatchVerificationResult } from './BatchVerificationService';