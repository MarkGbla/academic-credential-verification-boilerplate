import { Attestation, AttestationStatus } from '@prisma/client';
import { prisma } from '../prisma';
import { IAttestationRepository, CreateAttestationData, UpdateAttestationData } from './interfaces/IAttestationRepository';
import { AttestationWithRelations, AttestationRequest } from '../../types/attestation';

export class AttestationRepository implements IAttestationRepository {
  async create(data: CreateAttestationData): Promise<Attestation> {
    return prisma.attestation.create({
      data,
    });
  }

  async findById(id: string): Promise<Attestation | null> {
    return prisma.attestation.findUnique({
      where: { id },
    });
  }

  async findByIdWithRelations(id: string): Promise<AttestationWithRelations | null> {
    const attestation = await prisma.attestation.findUnique({
      where: { id },
      include: {
        credential: {
          select: {
            id: true,
            title: true,
            degreeType: true,
          },
        },
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        government: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    });

    return attestation as AttestationWithRelations | null;
  }

  async findBySolanaAddress(address: string): Promise<Attestation | null> {
    return prisma.attestation.findUnique({
      where: { solanaAddress: address },
    });
  }

  async findByTransactionHash(hash: string): Promise<Attestation | null> {
    return prisma.attestation.findUnique({
      where: { transactionHash: hash },
    });
  }

  async findByCredential(credentialId: string): Promise<Attestation[]> {
    return prisma.attestation.findMany({
      where: { credentialId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByCredentialWithRelations(credentialId: string): Promise<AttestationWithRelations[]> {
    const attestations = await prisma.attestation.findMany({
      where: { credentialId },
      include: {
        credential: {
          select: {
            id: true,
            title: true,
            degreeType: true,
          },
        },
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        government: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return attestations as AttestationWithRelations[];
  }

  async findByStudent(studentId: string): Promise<Attestation[]> {
    return prisma.attestation.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByStudentWithRelations(studentId: string): Promise<AttestationWithRelations[]> {
    const attestations = await prisma.attestation.findMany({
      where: { studentId },
      include: {
        credential: {
          select: {
            id: true,
            title: true,
            degreeType: true,
          },
        },
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        government: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return attestations as AttestationWithRelations[];
  }

  async findByGovernment(governmentId: string): Promise<Attestation[]> {
    return prisma.attestation.findMany({
      where: { governmentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByGovernmentWithRelations(governmentId: string): Promise<AttestationWithRelations[]> {
    const attestations = await prisma.attestation.findMany({
      where: { governmentId },
      include: {
        credential: {
          select: {
            id: true,
            title: true,
            degreeType: true,
          },
        },
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        government: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return attestations as AttestationWithRelations[];
  }

  async findPendingByGovernment(governmentId: string): Promise<AttestationRequest[]> {
    const attestations = await prisma.attestation.findMany({
      where: {
        governmentId,
        status: 'PENDING',
      },
      include: {
        credential: {
          select: {
            id: true,
            title: true,
            degreeType: true,
            graduationDate: true,
            university: {
              select: {
                name: true,
                code: true,
              },
            },
          },
        },
        student: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return attestations.map(attestation => ({
      id: attestation.id,
      credentialId: attestation.credentialId,
      studentId: attestation.studentId,
      status: attestation.status as AttestationStatus,
      createdAt: attestation.createdAt,
      credential: {
        id: attestation.credential.id,
        title: attestation.credential.title,
        degreeType: attestation.credential.degreeType,
        graduationDate: attestation.credential.graduationDate,
        university: attestation.credential.university,
      },
      student: attestation.student,
    }));
  }

  async update(id: string, data: UpdateAttestationData): Promise<Attestation> {
    return prisma.attestation.update({
      where: { id },
      data,
    });
  }

  async updateStatus(id: string, status: AttestationStatus): Promise<Attestation> {
    return prisma.attestation.update({
      where: { id },
      data: { status },
    });
  }

  async delete(id: string): Promise<void> {
    await prisma.attestation.delete({
      where: { id },
    });
  }

  async findMany(options?: {
    skip?: number;
    take?: number;
    where?: any;
    include?: any;
  }): Promise<Attestation[] | AttestationWithRelations[]> {
    return prisma.attestation.findMany({
      skip: options?.skip,
      take: options?.take,
      where: options?.where,
      include: options?.include,
      orderBy: { createdAt: 'desc' },
    }) as Promise<Attestation[] | AttestationWithRelations[]>;
  }

  async count(where?: any): Promise<number> {
    return prisma.attestation.count({
      where,
    });
  }
}