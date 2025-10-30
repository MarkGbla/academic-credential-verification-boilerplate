import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { apiHandler } from '../_lib/api-handler';
import { z } from 'zod';

// Validation schemas
const createUniversitySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().min(1, 'Code is required'),
  country: z.string().min(1, 'Country is required'),
  email: z.string().email('Invalid email address'),
  wallet: z.string().optional(),
  publicKey: z.string().min(1, 'Public key is required'),
});

const updateUniversitySchema = createUniversitySchema.partial();

// GET /api/universities - List all universities with optional filtering
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const country = searchParams.get('country');
  const isActive = searchParams.get('isActive');

  const universities = await prisma.university.findMany({
    where: {
      ...(country && { country }),
      ...(isActive !== null && { isActive: isActive === 'true' }),
    },
    select: {
      id: true,
      name: true,
      code: true,
      country: true,
      email: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: {
      name: 'asc',
    },
  });

  return NextResponse.json({ success: true, data: universities });
}

// POST /api/universities - Create a new university
export async function POST(req: NextRequest) {
  const data = await req.json();
  
  // Validate request body
  const result = createUniversitySchema.safeParse(data);
  if (!result.success) {
    return NextResponse.json(
      { success: false, errors: result.error.flatten() },
      { status: 400 }
    );
  }

  // Check if code or email already exists
  const existingUniversity = await prisma.university.findFirst({
    where: {
      OR: [
        { code: result.data.code },
        { email: result.data.email },
      ],
    },
  });

  if (existingUniversity) {
    return NextResponse.json(
      { 
        success: false, 
        message: 'University with this code or email already exists' 
      },
      { status: 409 }
    );
  }

  // Create the university
  const university = await prisma.university.create({
    data: {
      ...result.data,
      isActive: true,
    },
  });

  return NextResponse.json(
    { success: true, data: university },
    { status: 201 }
  );
}

// Handle all methods for /api/universities
export default apiHandler({
  GET,
  POST,
});
