import { Student } from '@prisma/client';
import { prisma } from '../prisma';
import { IStudentRepository, CreateStudentData, UpdateStudentData } from './interfaces/IStudentRepository';

export class StudentRepository implements IStudentRepository {
  async create(data: CreateStudentData): Promise<Student> {
    return prisma.student.create({
      data,
    });
  }

  async findById(id: string): Promise<Student | null> {
    return prisma.student.findUnique({
      where: { id },
    });
  }

  async findByEmail(email: string): Promise<Student | null> {
    return prisma.student.findUnique({
      where: { email },
    });
  }

  async findByNinHash(ninHash: string): Promise<Student | null> {
    return prisma.student.findUnique({
      where: { ninHash },
    });
  }

  async findBySolanaAddress(address: string): Promise<Student | null> {
    return prisma.student.findUnique({
      where: { solanaAddress: address },
    });
  }

  async update(id: string, data: UpdateStudentData): Promise<Student> {
    return prisma.student.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<void> {
    await prisma.student.delete({
      where: { id },
    });
  }

  async findMany(options?: {
    skip?: number;
    take?: number;
    where?: any;
  }): Promise<Student[]> {
    return prisma.student.findMany({
      skip: options?.skip,
      take: options?.take,
      where: options?.where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async count(where?: any): Promise<number> {
    return prisma.student.count({
      where,
    });
  }
}