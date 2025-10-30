import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { apiHandler, HttpException } from '../../../_lib/api-handler';
import { createStudentSchema } from '../route';

// Update schema for partial updates
const updateStudentSchema = createStudentSchema.partial();

// GET /api/students/[id] - Get a specific student by ID
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  
  const student = await prisma.student.findUnique({
    where: { id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      wallet: true,
      solanaAddress: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          credentials: true,
          attestations: true,
        },
      },
    },
  });

  if (!student) {
    throw new HttpException('Student not found', 404);
  }

  return NextResponse.json({ success: true, data: student });
}

// PUT /api/students/[id] - Update a student
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  
  try {
    const data = await req.json();
    const result = updateStudentSchema.safeParse(data);
    
    if (!result.success) {
      return NextResponse.json(
        { success: false, errors: result.error.flatten() },
        { status: 400 }
      );
    }

    // Check if student exists
    const existingStudent = await prisma.student.findUnique({
      where: { id },
    });

    if (!existingStudent) {
      throw new HttpException('Student not found', 404);
    }

    // Check for duplicate email, ninHash, or solanaAddress if they are being updated
    if (result.data.email || result.data.ninHash || result.data.solanaAddress) {
      const duplicate = await prisma.student.findFirst({
        where: {
          id: { not: id },
          OR: [
            ...(result.data.email ? [{ email: result.data.email }] : []),
            ...(result.data.ninHash ? [{ ninHash: result.data.ninHash }] : []),
            ...(result.data.solanaAddress ? [{ solanaAddress: result.data.solanaAddress }] : []),
          ],
        },
      });

      if (duplicate) {
        return NextResponse.json(
          { 
            success: false, 
            message: 'Another student with this email, NIN, or Solana address already exists' 
          },
          { status: 409 }
        );
      }
    }

    // Update the student
    const updatedStudent = await prisma.student.update({
      where: { id },
      data: {
        ...result.data,
        updatedAt: new Date(),
      },
    });

    // Don't return sensitive data
    const { ninHash: _, ...responseData } = updatedStudent;

    return NextResponse.json({ 
      success: true, 
      data: responseData 
    });
  } catch (error) {
    if (error instanceof HttpException) {
      throw error;
    }
    throw new HttpException('Failed to update student', 500);
  }
}

// DELETE /api/students/[id] - Delete a student
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  try {
    // Check if student exists and has associated records
    const student = await prisma.student.findUnique({
      where: { id },
      include: {
        _count: {
          select: { 
            credentials: true,
            attestations: true 
          },
        },
      },
    });

    if (!student) {
      throw new HttpException('Student not found', 404);
    }

    // Prevent deletion if there are associated credentials or attestations
    if (student._count.credentials > 0 || student._count.attestations > 0) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Cannot delete student with associated credentials or attestations' 
        },
        { status: 400 }
      );
    }

    // Delete the student
    await prisma.student.delete({
      where: { id },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof HttpException) {
      throw error;
    }
    throw new HttpException('Failed to delete student', 500);
  }
}

// Export individual route handlers for Next.js App Router
export { GET, PUT, DELETE };
