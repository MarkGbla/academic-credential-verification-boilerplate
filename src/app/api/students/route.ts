import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { apiHandler } from '../_lib/api-handler';
import { z } from 'zod';
import { hash } from 'bcryptjs';

// Validation schemas
const createStudentSchema = z.object({
  ninHash: z.string().min(1, 'NIN hash is required'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  wallet: z.string().optional(),
  solanaAddress: z.string().min(1, 'Solana address is required'),
});

// GET /api/students - List all students with optional filtering
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get('email');
  const isActive = searchParams.get('isActive');

  const students = await prisma.student.findMany({
    where: {
      ...(email && { email: { contains: email, mode: 'insensitive' } }),
      ...(isActive !== null && { isActive: isActive === 'true' }),
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      solanaAddress: true,
      isActive: true,
      createdAt: true,
      _count: {
        select: {
          credentials: true,
          attestations: true,
        },
      },
    },
    orderBy: {
      lastName: 'asc',
    },
  });

  return NextResponse.json({ success: true, data: students });
}

// POST /api/students - Create a new student
export async function POST(req: NextRequest) {
  const data = await req.json();
  
  // Validate request body
  const result = createStudentSchema.safeParse(data);
  if (!result.success) {
    return NextResponse.json(
      { success: false, errors: result.error.flatten() },
      { status: 400 }
    );
  }

  // Check if email, ninHash, or solanaAddress already exists
  const existingStudent = await prisma.student.findFirst({
    where: {
      OR: [
        { email: result.data.email },
        { ninHash: result.data.ninHash },
        { solanaAddress: result.data.solanaAddress },
      ],
    },
  });

  if (existingStudent) {
    return NextResponse.json(
      { 
        success: false, 
        message: 'Student with this email, NIN, or Solana address already exists' 
      },
      { status: 409 }
    );
  }

  // Create the student
  const student = await prisma.student.create({
    data: {
      ...result.data,
      isActive: true,
    },
  });

  // Don't return sensitive data
  const { ninHash: _, ...responseData } = student;

  return NextResponse.json(
    { success: true, data: responseData },
    { status: 201 }
  );
}

// Handle all methods for /api/students
export default apiHandler({
  GET,
  POST,
});
