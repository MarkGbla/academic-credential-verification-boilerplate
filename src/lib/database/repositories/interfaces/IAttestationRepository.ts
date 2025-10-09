import { Attestation, AttestationType, AttestationStatus } from '@prisma/client';
import { AttestationWithRelations, AttestationRequest } from '../../../types/attestation';

export interface CreateAttestationData {
  solanaAddress: string;
  transactionHash: string;
  attestationType: AttestationType;
  credentialId: string;
  studentId: string;
  governmentId?: string;
}

export interface UpdateAttestationData {
  status?: AttestationStatus;
  governmentId?: string;
}

export interface IAttestationRepository {
  create(data: CreateAttestationData): Promise<Attestation>;
  findById(id: string): Promise<Attestation | null>;
  findByIdWithRelations(id: string): Promise<AttestationWithRelations | null>;
  findBySolanaAddress(address: string): Promise<Attestation | null>;
  findByTransactionHash(hash: string): Promise<Attestation | null>;
  findByCredential(credentialId: string): Promise<Attestation[]>;
  findByCredentialWithRelations(credentialId: string): Promise<AttestationWithRelations[]>;
  findByStudent(studentId: string): Promise<Attestation[]>;
  findByStudentWithRelations(studentId: string): Promise<AttestationWithRelations[]>;
  findByGovernment(governmentId: string): Promise<Attestation[]>;
  findByGovernmentWithRelations(governmentId: string): Promise<AttestationWithRelations[]>;
  findPendingByGovernment(governmentId: string): Promise<AttestationRequest[]>;
  update(id: string, data: UpdateAttestationData): Promise<Attestation>;
  updateStatus(id: string, status: AttestationStatus): Promise<Attestation>;
  delete(id: string): Promise<void>;
  findMany(options?: {
    skip?: number;
    take?: number;
    where?: any;
    include?: any;
  }): Promise<Attestation[] | AttestationWithRelations[]>;
  count(where?: any): Promise<number>;
}