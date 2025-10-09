import { z } from 'zod';
import { DegreeType, CredentialStatus } from '../types/credential';
import { AttestationType, AttestationStatus } from '../types/attestation';
import { UserRole } from '../types/user';

// User validation schemas
export const createStudentSchema = z.object({
  nin: z.string().min(10, 'NIN must be at least 10 characters'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email format'),
  wallet: z.string().optional(),
});

export const createUniversitySchema = z.object({
  name: z.string().min(1, 'University name is required'),
  code: z.string().min(2, 'University code must be at least 2 characters'),
  country: z.string().min(2, 'Country is required'),
  email: z.string().email('Invalid email format'),
  publicKey: z.string().min(1, 'Public key is required'),
  wallet: z.string().optional(),
});

export const createGovernmentSchema = z.object({
  name: z.string().min(1, 'Government entity name is required'),
  type: z.enum(['MINISTRY_OF_EDUCATION', 'MINISTRY_OF_FOREIGN_AFFAIRS', 'ACCREDITATION_BODY']),
  country: z.string().min(2, 'Country is required'),
  publicKey: z.string().min(1, 'Public key is required'),
  wallet: z.string().optional(),
});

// Credential validation schemas
export const createCredentialSchema = z.object({
  title: z.string().min(1, 'Credential title is required'),
  degreeType: z.nativeEnum(DegreeType),
  major: z.string().optional(),
  graduationDate: z.string().transform((str) => new Date(str)),
  gpa: z.number().min(0).max(4).optional(),
  expiryDate: z.string().transform((str) => new Date(str)).optional(),
  metadata: z.record(z.any()).optional(),
  universityId: z.string().uuid('Invalid university ID'),
  studentId: z.string().uuid('Invalid student ID'),
});

export const updateCredentialSchema = z.object({
  title: z.string().min(1).optional(),
  status: z.nativeEnum(CredentialStatus).optional(),
  expiryDate: z.string().transform((str) => new Date(str)).optional(),
  metadata: z.record(z.any()).optional(),
});

// Attestation validation schemas
export const createAttestationSchema = z.object({
  credentialId: z.string().uuid('Invalid credential ID'),
  studentId: z.string().uuid('Invalid student ID'),
  attestationType: z.nativeEnum(AttestationType),
  governmentId: z.string().uuid('Invalid government ID').optional(),
});

// Authentication validation schemas
export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.nativeEnum(UserRole),
});

// Validation helper functions
export function validateNIN(nin: string): boolean {
  // Basic NIN validation - adjust based on your country's NIN format
  return /^\d{10,15}$/.test(nin);
}

export function validateSolanaAddress(address: string): boolean {
  // Basic Solana address validation
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}