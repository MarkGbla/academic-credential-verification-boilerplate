import { Credential, CredentialStatus, DegreeType } from '@prisma/client';
import { CredentialWithRelations } from '../../../types/credential';

export interface CreateCredentialData {
  title: string;
  degreeType: DegreeType;
  major?: string;
  graduationDate: Date;
  gpa?: number;
  expiryDate?: Date;
  metadata?: any;
  universityId: string;
  studentId: string;
}

export interface UpdateCredentialData {
  title?: string;
  status?: CredentialStatus;
  expiryDate?: Date;
  metadata?: any;
}

export interface ICredentialRepository {
  create(data: CreateCredentialData): Promise<Credential>;
  findById(id: string): Promise<Credential | null>;
  findByIdWithRelations(id: string): Promise<CredentialWithRelations | null>;
  findByStudent(studentId: string): Promise<Credential[]>;
  findByStudentWithRelations(studentId: string): Promise<CredentialWithRelations[]>;
  findByUniversity(universityId: string): Promise<Credential[]>;
  findByUniversityWithRelations(universityId: string): Promise<CredentialWithRelations[]>;
  update(id: string, data: UpdateCredentialData): Promise<Credential>;
  updateStatus(id: string, status: CredentialStatus): Promise<Credential>;
  delete(id: string): Promise<void>;
  findMany(options?: {
    skip?: number;
    take?: number;
    where?: any;
    include?: any;
  }): Promise<Credential[] | CredentialWithRelations[]>;
  count(where?: any): Promise<number>;
}