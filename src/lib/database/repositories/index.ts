// Repository implementations
export { StudentRepository } from './StudentRepository';
export { UniversityRepository } from './UniversityRepository';
export { GovernmentRepository } from './GovernmentRepository';
export { CredentialRepository } from './CredentialRepository';
export { AttestationRepository } from './AttestationRepository';

// Repository interfaces
export type { IStudentRepository } from './interfaces/IStudentRepository';
export type { IUniversityRepository } from './interfaces/IUniversityRepository';
export type { IGovernmentRepository } from './interfaces/IGovernmentRepository';
export type { ICredentialRepository } from './interfaces/ICredentialRepository';
export type { IAttestationRepository } from './interfaces/IAttestationRepository';

// Data types
export type { CreateStudentData, UpdateStudentData } from './interfaces/IStudentRepository';
export type { CreateUniversityData, UpdateUniversityData } from './interfaces/IUniversityRepository';
export type { CreateGovernmentData, UpdateGovernmentData } from './interfaces/IGovernmentRepository';
export type { CreateCredentialData, UpdateCredentialData } from './interfaces/ICredentialRepository';
export type { CreateAttestationData, UpdateAttestationData } from './interfaces/IAttestationRepository';