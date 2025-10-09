import { Government, GovernmentType } from '@prisma/client';
import { prisma } from '../prisma';
import { IGovernmentRepository, CreateGovernmentData, UpdateGovernmentData } from './interfaces/IGovernmentRepository';

export class GovernmentRepository implements IGovernmentRepository {
  async create(data: CreateGovernmentData): Promise<Government> {
    return prisma.government.create({
      data,
    });
  }

  async findById(id: string): Promise<Government | null> {
    return prisma.government.findUnique({
      where: { id },
    });
  }

  async findByType(type: GovernmentType, country?: string): Promise<Government[]> {
    return prisma.government.findMany({
      where: {
        type,
        ...(country && { country }),
        isActive: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(id: string, data: UpdateGovernmentData): Promise<Government> {
    return prisma.government.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<void> {
    await prisma.government.delete({
      where: { id },
    });
  }

  async findMany(options?: {
    skip?: number;
    take?: number;
    where?: any;
  }): Promise<Government[]> {
    return prisma.government.findMany({
      skip: options?.skip,
      take: options?.take,
      where: options?.where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async count(where?: any): Promise<number> {
    return prisma.government.count({
      where,
    });
  }
}