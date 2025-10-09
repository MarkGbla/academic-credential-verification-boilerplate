import { Credential, CredentialStatus } from '@prisma/client';
import { prisma } from '../prisma';
import { ICredentialRepository, CreateCredentialData, UpdateCredentialData } from './interfaces/ICredentialRepository';
import { CredentialWithRelations } from '../../types/credential';

export class CredentialRepository implements ICredentialRepository {
  async create(data: CreateCredentialData): Promise<Credential> {
    return prisma.credential.create({
      data,
    });
  }

  async findById(id: string): Promise<Credential | null> {
    return prisma.credential.findUnique({
      where: { id },
    });
  }

  async findByIdWithRelations(id: string): Promise<CredentialWithRelations | null> {
    const credential = await prisma.credential.findUnique({
      where: { id },
      include: {
        university: {
          select: {
            id: true,
            name: true,
            code: true,
            country: true,
          },
        },
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        attestations: {
          select: {
            id: true,
            solanaAddress: true,
            transactionHash: true,
            attestationType: true,
            status: true,
          },
        },
      },
    });

    return credential as CredentialWithRelations | null;
  }

  async findByStudent(studentId: string): Promise<Credential[]> {
    return prisma.credential.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByStudentWithRelations(studentId: string): Promise<CredentialWithRelations[]> {
    const credentials = await prisma.credential.findMany({
      where: { studentId },
      include: {
        university: {
          select: {
            id: true,
            name: true,
            code: true,
            country: true,
          },
        },
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        attestations: {
          select: {
            id: true,
            solanaAddress: true,
            transactionHash: true,
            attestationType: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return credentials as CredentialWithRelations[];
  }

  async findByUniversity(universityId: string): Promise<Credential[]> {
    return prisma.credential.findMany({
      where: { universityId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByUniversityWithRelations(universityId: string): Promise<CredentialWithRelations[]> {
    const credentials = await prisma.credential.findMany({
      where: { universityId },
      include: {
        university: {
          select: {
            id: true,
            name: true,
            code: true,
            country: true,
          },
        },
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        attestations: {
          select: {
            id: true,
            solanaAddress: true,
            transactionHash: true,
            attestationType: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return credentials as CredentialWithRelations[];
  }

  async update(id: string, data: UpdateCredentialData): Promise<Credential> {
    return prisma.credential.update({
      where: { id },
      data,
    });
  }

  async updateStatus(id: string, status: CredentialStatus): Promise<Credential> {
    return prisma.credential.update({
      where: { id },
      data: { status },
    });
  }

  async delete(id: string): Promise<void> {
    await prisma.credential.delete({
      where: { id },
    });
  }

  async findMany(options?: {
    skip?: number;
    take?: number;
    where?: any;
    include?: any;
  }): Promise<Credential[] | CredentialWithRelations[]> {
    return prisma.credential.findMany({
      skip: options?.skip,
      take: options?.take,
      where: options?.where,
      include: options?.include,
      orderBy: { createdAt: 'desc' },
    }) as Promise<Credential[] | CredentialWithRelations[]>;
  }

  async count(where?: any): Promise<number> {
    return prisma.credential.count({
      where,
    });
  }
}