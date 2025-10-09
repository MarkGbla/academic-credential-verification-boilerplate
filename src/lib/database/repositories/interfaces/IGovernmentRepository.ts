import { Government, GovernmentType } from '@prisma/client';

export interface CreateGovernmentData {
  name: string;
  type: GovernmentType;
  country: string;
  publicKey: string;
  wallet?: string;
}

export interface UpdateGovernmentData {
  name?: string;
  country?: string;
  wallet?: string;
  isActive?: boolean;
}

export interface IGovernmentRepository {
  create(data: CreateGovernmentData): Promise<Government>;
  findById(id: string): Promise<Government | null>;
  findByType(type: GovernmentType, country?: string): Promise<Government[]>;
  update(id: string, data: UpdateGovernmentData): Promise<Government>;
  delete(id: string): Promise<void>;
  findMany(options?: {
    skip?: number;
    take?: number;
    where?: any;
  }): Promise<Government[]>;
  count(where?: any): Promise<number>;
}