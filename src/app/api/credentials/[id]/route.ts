import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { apiHandler, HttpException } from '../../_lib/api-handler';
import { z } from 'zod';

// Define the update schema
const updateCredentialSchema = z.object({
  title: z.string().min(1, 'Title is required').optional(),
  status: z.enum(['ACTIVE', 'REVOKED', 'EXPIRED']).optional(),
  expiryDate: z.string().datetime().optional(),
  metadata: z.record(z.any()).optional()
});

type ParamsType = {
  params: {
    id: string;
  };
};

// Helper function to get credential by ID
async function getCredentialById(id: string) {
  const credential = await prisma.credential.findUnique({
    where: { id },
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      university: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
      attestations: {
        select: {
          id: true,
          status: true,
          attestationType: true,
          createdAt: true,
          government: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
        },
      },
    },
  });

  if (!credential) {
    throw new HttpException('Credential not found', 404);
  }

  return credential;
}

// GET /api/credentials/[id] - Get a specific credential by ID
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const credential = await getCredentialById(id);
  return NextResponse.json(credential);
}

// PUT /api/credentials/[id] - Update a credential
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  
  try {
    // Parse and validate request body
    const body = await req.json().catch(() => ({}));
    const data = updateCredentialSchema.parse(body);

    const updatedCredential = await prisma.credential.update({
      where: { id },
      data: {
        title: data.title,
        status: data.status,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
        metadata: data.metadata,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json(updatedCredential);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new HttpException('Invalid request data', 400);
    }
    throw new HttpException('Failed to update credential', 400);
  }
}

// DELETE /api/credentials/[id] - Delete a credential
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  try {
    // Check if credential exists
    const existingCredential = await prisma.credential.findUnique({
      where: { id },
    });

    if (!existingCredential) {
      throw new HttpException('Credential not found', 404);
    }

    // Delete related attestations first (if any)
    await prisma.attestation.deleteMany({
      where: { credentialId: id },
    });

    // Delete the credential
    await prisma.credential.delete({
      where: { id },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof HttpException) {
      throw error;
    }
    throw new HttpException('Failed to delete credential', 500);
  }
}

// Export individual route handlers for Next.js App Router
export { GET, PUT, DELETE };
