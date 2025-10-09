import { Student } from '@prisma/client';

export interface CreateStudentData {
  ninHash: string;
  firstName: string;
  lastName: string;
  email: string;
  solanaAddress: string;
  wallet?: string;
}

export interface UpdateStudentData {
  firstName?: string;
  lastName?: string;
  email?: string;
  wallet?: string;
  isActive?: boolean;
}

export interface IStudentRepository {
  create(data: CreateStudentData): Promise<Student>;
  findById(id: string): Promise<Student | null>;
  findByEmail(email: string): Promise<Student | null>;
  findByNinHash(ninHash: string): Promise<Student | null>;
  findBySolanaAddress(address: string): Promise<Student | null>;
  update(id: string, data: UpdateStudentData): Promise<Student>;
  delete(id: string): Promise<void>;
  findMany(options?: {
    skip?: number;
    take?: number;
    where?: any;
  }): Promise<Student[]>;
  count(where?: any): Promise<number>;
}