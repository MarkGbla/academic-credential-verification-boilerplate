import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { apiHandler, HttpException } from '../../../_lib/api-handler';
import { updateUniversitySchema } from '../route';

// GET /api/universities/[id] - Get a specific university by ID
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  
  const university = await prisma.university.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      code: true,
      country: true,
      email: true,
      wallet: true,
      publicKey: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          credentials: true,
        },
      },
    },
  });

  if (!university) {
    throw new HttpException('University not found', 404);
  }

  return NextResponse.json({ success: true, data: university });
}

// PUT /api/universities/[id] - Update a university
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  
  try {
    const data = await req.json();
    const result = updateUniversitySchema.safeParse(data);
    
    if (!result.success) {
      return NextResponse.json(
        { success: false, errors: result.error.flatten() },
        { status: 400 }
      );
    }

    // Check if university exists
    const existingUniversity = await prisma.university.findUnique({
      where: { id },
    });

    if (!existingUniversity) {
      throw new HttpException('University not found', 404);
    }

    // Check for duplicate code or email if they are being updated
    if (result.data.code || result.data.email) {
      const duplicate = await prisma.university.findFirst({
        where: {
          id: { not: id },
          OR: [
            ...(result.data.code ? [{ code: result.data.code }] : []),
            ...(result.data.email ? [{ email: result.data.email }] : []),
          ],
        },
      });

      if (duplicate) {
        return NextResponse.json(
          { 
            success: false, 
            message: 'Another university with this code or email already exists' 
          },
          { status: 409 }
        );
      }
    }

    // Update the university
    const updatedUniversity = await prisma.university.update({
      where: { id },
      data: {
        ...result.data,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ 
      success: true, 
      data: updatedUniversity 
    });
  } catch (error) {
    if (error instanceof HttpException) {
      throw error;
    }
    throw new HttpException('Failed to update university', 500);
  }
}

// DELETE /api/universities/[id] - Delete a university
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  try {
    // Check if university exists
    const university = await prisma.university.findUnique({
      where: { id },
      include: {
        _count: {
          select: { credentials: true },
        },
      },
    });

    if (!university) {
      throw new HttpException('University not found', 404);
    }

    // Prevent deletion if there are associated credentials
    if (university._count.credentials > 0) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Cannot delete university with associated credentials' 
        },
        { status: 400 }
      );
    }

    // Delete the university
    await prisma.university.delete({
      where: { id },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof HttpException) {
      throw error;
    }
    throw new HttpException('Failed to delete university', 500);
  }
}

// Export individual route handlers for Next.js App Router
export { GET, PUT, DELETE };
