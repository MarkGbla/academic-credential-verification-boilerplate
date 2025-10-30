import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { apiHandler } from '../_lib/api-handler';
import { createCredentialSchema, updateCredentialSchema } from '@/lib/utils/validation';
import { validateRequest } from '@/middleware/validation';

// GET /api/credentials - List all credentials with optional filtering
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get('studentId');
  const universityId = searchParams.get('universityId');
  const status = searchParams.get('status');

  const credentials = await prisma.credential.findMany({
    where: {
      ...(studentId && { studentId }),
      ...(universityId && { universityId }),
      ...(status && { status }),
    },
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
    },
    orderBy: {
      issuanceDate: 'desc',
    },
  });

  return NextResponse.json({ success: true, data: credentials });
}

// POST /api/credentials - Create a new credential
export async function POST(req: NextRequest) {
  const data = await req.json();
  
  // Validate request body
  const result = createCredentialSchema.safeParse(data);
  if (!result.success) {
    return NextResponse.json(
      { success: false, errors: result.error.flatten() },
      { status: 400 }
    );
  }

  // Check if student and university exist
  const [student, university] = await Promise.all([
    prisma.student.findUnique({ where: { id: result.data.studentId } }),
    prisma.university.findUnique({ where: { id: result.data.universityId } }),
  ]);

  if (!student) {
    return NextResponse.json(
      { success: false, message: 'Student not found' },
      { status: 404 }
    );
  }

  if (!university) {
    return NextResponse.json(
      { success: false, message: 'University not found' },
      { status: 404 }
    );
  }

  // Create the credential
  const credential = await prisma.credential.create({
    data: {
      ...result.data,
      status: 'ACTIVE',
    },
  });

  return NextResponse.json(
    { success: true, data: credential },
    { status: 201 }
  );
}

// Handle all methods for /api/credentials
export default apiHandler({
  GET,
  POST,
});
