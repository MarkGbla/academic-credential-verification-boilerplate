import { PrismaClient, Government, Prisma } from '@prisma/client';
import { IGovernmentRepository, CreateGovernmentData, UpdateGovernmentData } from './interfaces/IGovernmentRepository';

export class PrismaGovernmentRepository implements IGovernmentRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreateGovernmentData): Promise<Government> {
    return this.prisma.government.create({
      data: {
        name: data.name,
        type: data.type,
        country: data.country,
        wallet: data.wallet,
        publicKey: data.publicKey,
        isActive: data.isActive ?? true,
      },
    });
  }

  async findById(id: string): Promise<Government | null> {
    return this.prisma.government.findUnique({
      where: { id },
    });
  }

  async findByWallet(wallet: string): Promise<Government | null> {
    return this.prisma.government.findFirst({
      where: { wallet },
    });
  }

  async findByCountry(country: string): Promise<Government[]> {
    return this.prisma.government.findMany({
      where: { country },
    });
  }

  async update(id: string, data: UpdateGovernmentData): Promise<Government> {
    return this.prisma.government.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.government.delete({
      where: { id },
    });
  }

  async findMany(options?: {
    skip?: number;
    take?: number;
    where?: any;
    include?: any;
  }): Promise<Government[]> {
    const { skip, take, where, include } = options || {};
    
    return this.prisma.government.findMany({
      skip,
      take,
      where,
      include,
    });
  }

  async count(where?: any): Promise<number> {
    return this.prisma.government.count({
      where,
    });
  }
}
