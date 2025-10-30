import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { apiHandler } from '../_lib/api-handler';
import { z } from 'zod';

// Validation schemas
const createAttestationSchema = z.object({
  solanaAddress: z.string().min(1, 'Solana address is required'),
  transactionHash: z.string().min(1, 'Transaction hash is required'),
  attestationType: z.enum(['UNIVERSITY_ISSUED', 'GOVERNMENT_ACCREDITED']),
  credentialId: z.string().min(1, 'Credential ID is required'),
  studentId: z.string().min(1, 'Student ID is required'),
  governmentId: z.string().optional(),
});

// GET /api/attestations - List all attestations with optional filtering
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get('studentId');
  const credentialId = searchParams.get('credentialId');
  const status = searchParams.get('status');
  const type = searchParams.get('type');

  const attestations = await prisma.attestation.findMany({
    where: {
      ...(studentId && { studentId }),
      ...(credentialId && { credentialId }),
      ...(status && { status: status as any }),
      ...(type && { attestationType: type as any }),
    },
    include: {
      credential: {
        select: {
          id: true,
          title: true,
          degreeType: true,
          status: true,
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
      government: {
        select: {
          id: true,
          name: true,
          type: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return NextResponse.json({ success: true, data: attestations });
}

// POST /api/attestations - Create a new attestation
export async function POST(req: NextRequest) {
  const data = await req.json();
  
  // Validate request body
  const result = createAttestationSchema.safeParse(data);
  if (!result.success) {
    return NextResponse.json(
      { success: false, errors: result.error.flatten() },
      { status: 400 }
    );
  }

  // Check if credential exists
  const credential = await prisma.credential.findUnique({
    where: { id: result.data.credentialId },
  });

  if (!credential) {
    return NextResponse.json(
      { success: false, message: 'Credential not found' },
      { status: 404 }
    );
  }

  // Check if student exists
  const student = await prisma.student.findUnique({
    where: { id: result.data.studentId },
  });

  if (!student) {
    return NextResponse.json(
      { success: false, message: 'Student not found' },
      { status: 404 }
    );
  }

  // If governmentId is provided, check if government exists
  if (result.data.governmentId) {
    const government = await prisma.government.findUnique({
      where: { id: result.data.governmentId },
    });

    if (!government) {
      return NextResponse.json(
        { success: false, message: 'Government entity not found' },
        { status: 404 }
      );
    }
  }

  // Check for duplicate solanaAddress or transactionHash
  const duplicate = await prisma.attestation.findFirst({
    where: {
      OR: [
        { solanaAddress: result.data.solanaAddress },
        { transactionHash: result.data.transactionHash },
      ],
    },
  });

  if (duplicate) {
    return NextResponse.json(
      { 
        success: false, 
        message: 'An attestation with this Solana address or transaction hash already exists' 
      },
      { status: 409 }
    );
  }

  // Create the attestation
  const attestation = await prisma.attestation.create({
    data: {
      ...result.data,
      status: 'PENDING', // Default status
    },
  });

  return NextResponse.json(
    { success: true, data: attestation },
    { status: 201 }
  );
}

// Handle all methods for /api/attestations
export default apiHandler({
  GET,
  POST,
});
