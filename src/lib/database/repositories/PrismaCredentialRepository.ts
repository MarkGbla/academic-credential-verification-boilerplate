import { PrismaClient, Credential, Prisma } from '@prisma/client';
import { ICredentialRepository, CreateCredentialData, UpdateCredentialData } from './interfaces/ICredentialRepository';
import { CredentialWithRelations } from '../../../types/credential';

export class PrismaCredentialRepository implements ICredentialRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreateCredentialData): Promise<Credential> {
    return this.prisma.credential.create({
      data: {
        title: data.title,
        degreeType: data.degreeType,
        major: data.major,
        graduationDate: data.graduationDate,
        gpa: data.gpa,
        expiryDate: data.expiryDate,
        metadata: data.metadata || {},
        universityId: data.universityId,
        studentId: data.studentId,
      },
    });
  }

  async findById(id: string): Promise<Credential | null> {
    return this.prisma.credential.findUnique({
      where: { id },
    });
  }

  async findByIdWithRelations(id: string): Promise<CredentialWithRelations | null> {
    return this.prisma.credential.findUnique({
      where: { id },
      include: {
        university: true,
        student: true,
        attestations: true,
      },
    }) as Promise<CredentialWithRelations | null>;
  }

  async findByStudent(studentId: string): Promise<Credential[]> {
    return this.prisma.credential.findMany({
      where: { studentId },
    });
  }

  async findByStudentWithRelations(studentId: string): Promise<CredentialWithRelations[]> {
    return this.prisma.credential.findMany({
      where: { studentId },
      include: {
        university: true,
        student: true,
        attestations: true,
      },
    }) as Promise<CredentialWithRelations[]>;
  }

  async findByUniversity(universityId: string): Promise<Credential[]> {
    return this.prisma.credential.findMany({
      where: { universityId },
    });
  }

  async findByUniversityWithRelations(universityId: string): Promise<CredentialWithRelations[]> {
    return this.prisma.credential.findMany({
      where: { universityId },
      include: {
        university: true,
        student: true,
        attestations: true,
      },
    }) as Promise<CredentialWithRelations[]>;
  }

  async update(id: string, data: UpdateCredentialData): Promise<Credential> {
    return this.prisma.credential.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });
  }

  async updateStatus(id: string, status: string): Promise<Credential> {
    return this.prisma.credential.update({
      where: { id },
      data: {
        status: status as any, // Type assertion since we know the status is valid
        updatedAt: new Date(),
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.credential.delete({
      where: { id },
    });
  }

  async findMany(options?: {
    skip?: number;
    take?: number;
    where?: any;
    include?: any;
  }): Promise<Credential[] | CredentialWithRelations[]> {
    const { skip, take, where, include } = options || {};
    
    return this.prisma.credential.findMany({
      skip,
      take,
      where,
      include,
    });
  }

  async count(where?: any): Promise<number> {
    return this.prisma.credential.count({
      where,
    });
  }
}
