import { PrismaClient, University, Prisma } from '@prisma/client';
import { IUniversityRepository, CreateUniversityData, UpdateUniversityData } from './interfaces/IUniversityRepository';

export class PrismaUniversityRepository implements IUniversityRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreateUniversityData): Promise<University> {
    return this.prisma.university.create({
      data: {
        name: data.name,
        code: data.code,
        country: data.country,
        email: data.email,
        wallet: data.wallet,
        publicKey: data.publicKey,
        isActive: data.isActive ?? true,
      },
    });
  }

  async findById(id: string): Promise<University | null> {
    return this.prisma.university.findUnique({
      where: { id },
    });
  }

  async findByCode(code: string): Promise<University | null> {
    return this.prisma.university.findUnique({
      where: { code },
    });
  }

  async findByEmail(email: string): Promise<University | null> {
    return this.prisma.university.findUnique({
      where: { email },
    });
  }

  async findByWallet(wallet: string): Promise<University | null> {
    return this.prisma.university.findFirst({
      where: { wallet },
    });
  }

  async update(id: string, data: UpdateUniversityData): Promise<University> {
    return this.prisma.university.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.university.delete({
      where: { id },
    });
  }

  async findMany(options?: {
    skip?: number;
    take?: number;
    where?: any;
    include?: any;
  }): Promise<University[]> {
    const { skip, take, where, include } = options || {};
    
    return this.prisma.university.findMany({
      skip,
      take,
      where,
      include,
    });
  }

  async count(where?: any): Promise<number> {
    return this.prisma.university.count({
      where,
    });
  }
}
