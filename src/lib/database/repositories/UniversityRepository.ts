import { University } from '@prisma/client';
import { prisma } from '../prisma';
import { IUniversityRepository, CreateUniversityData, UpdateUniversityData } from './interfaces/IUniversityRepository';

export class UniversityRepository implements IUniversityRepository {
  async create(data: CreateUniversityData): Promise<University> {
    return prisma.university.create({
      data,
    });
  }

  async findById(id: string): Promise<University | null> {
    return prisma.university.findUnique({
      where: { id },
    });
  }

  async findByEmail(email: string): Promise<University | null> {
    return prisma.university.findUnique({
      where: { email },
    });
  }

  async findByCode(code: string): Promise<University | null> {
    return prisma.university.findUnique({
      where: { code },
    });
  }

  async update(id: string, data: UpdateUniversityData): Promise<University> {
    return prisma.university.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<void> {
    await prisma.university.delete({
      where: { id },
    });
  }

  async findMany(options?: {
    skip?: number;
    take?: number;
    where?: any;
  }): Promise<University[]> {
    return prisma.university.findMany({
      skip: options?.skip,
      take: options?.take,
      where: options?.where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async count(where?: any): Promise<number> {
    return prisma.university.count({
      where,
    });
  }
}