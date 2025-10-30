import { PrismaClient, Student, Prisma } from '@prisma/client';
import { IStudentRepository, CreateStudentData, UpdateStudentData } from './interfaces/IStudentRepository';

export class PrismaStudentRepository implements IStudentRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreateStudentData): Promise<Student> {
    return this.prisma.student.create({
      data: {
        ninHash: data.ninHash,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        wallet: data.wallet,
        solanaAddress: data.solanaAddress,
        isActive: data.isActive ?? true,
      },
    });
  }

  async findById(id: string): Promise<Student | null> {
    return this.prisma.student.findUnique({
      where: { id },
    });
  }

  async findByNINHash(ninHash: string): Promise<Student | null> {
    return this.prisma.student.findUnique({
      where: { ninHash },
    });
  }

  async findByEmail(email: string): Promise<Student | null> {
    return this.prisma.student.findUnique({
      where: { email },
    });
  }

  async findByWallet(wallet: string): Promise<Student | null> {
    return this.prisma.student.findFirst({
      where: { wallet },
    });
  }

  async findBySolanaAddress(solanaAddress: string): Promise<Student | null> {
    return this.prisma.student.findUnique({
      where: { solanaAddress },
    });
  }

  async update(id: string, data: UpdateStudentData): Promise<Student> {
    return this.prisma.student.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.student.delete({
      where: { id },
    });
  }

  async findMany(options?: {
    skip?: number;
    take?: number;
    where?: any;
    include?: any;
  }): Promise<Student[]> {
    const { skip, take, where, include } = options || {};
    
    return this.prisma.student.findMany({
      skip,
      take,
      where,
      include,
    });
  }

  async count(where?: any): Promise<number> {
    return this.prisma.student.count({
      where,
    });
  }
}
