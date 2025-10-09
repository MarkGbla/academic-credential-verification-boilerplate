import { University } from '@prisma/client';

export interface CreateUniversityData {
  name: string;
  code: string;
  country: string;
  email: string;
  publicKey: string;
  wallet?: string;
}

export interface UpdateUniversityData {
  name?: string;
  country?: string;
  email?: string;
  wallet?: string;
  isActive?: boolean;
}

export interface IUniversityRepository {
  create(data: CreateUniversityData): Promise<University>;
  findById(id: string): Promise<University | null>;
  findByEmail(email: string): Promise<University | null>;
  findByCode(code: string): Promise<University | null>;
  update(id: string, data: UpdateUniversityData): Promise<University>;
  delete(id: string): Promise<void>;
  findMany(options?: {
    skip?: number;
    take?: number;
    where?: any;
  }): Promise<University[]>;
  count(where?: any): Promise<number>;
}