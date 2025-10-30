import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';

/**
 * Base HTTP Exception class
 */
export class HttpException extends Error {
  constructor(
    public status: number,
    public message: string,
    public code?: string,
    public errors?: Record<string, any>,
  ) {
    super(message);
    this.name = this.constructor.name;
    // Only capture stack trace in development
    if (process.env.NODE_ENV === 'development') {
      Error.captureStackTrace?.(this, this.constructor);
    }
  }

  /**
   * Convert the exception to a JSON response
   */
  toResponse(): { status: number; body: any } {
    return {
      status: this.status,
      body: {
        success: false,
        error: {
          message: this.message,
          ...(this.code && { code: this.code }),
          ...(this.errors && { details: this.errors }),
          ...(process.env.NODE_ENV === 'development' && { stack: this.stack }),
        },
      },
    };
  }
}

/**
 * 400 Bad Request
 */
export class BadRequestException extends HttpException {
  constructor(message = 'Bad Request', errors?: Record<string, any>) {
    super(400, message, 'BAD_REQUEST', errors);
  }
}

/**
 * 401 Unauthorized
 */
export class UnauthorizedException extends HttpException {
  constructor(message = 'Unauthorized') {
    super(401, message, 'UNAUTHORIZED');
  }
}

/**
 * 403 Forbidden
 */
export class ForbiddenException extends HttpException {
  constructor(message = 'Forbidden') {
    super(403, message, 'FORBIDDEN');
  }
}

/**
 * 404 Not Found
 */
export class NotFoundException extends HttpException {
  constructor(entity: string) {
    super(404, `${entity} not found`, 'NOT_FOUND');
  }
}

/**
 * 409 Conflict
 */
export class ConflictException extends HttpException {
  constructor(message = 'Conflict') {
    super(409, message, 'CONFLICT');
  }
}

/**
 * 422 Unprocessable Entity (Validation Error)
 */
export class ValidationException extends HttpException {
  constructor(errors: Record<string, string[]>) {
    super(422, 'Validation failed', 'VALIDATION_ERROR', errors);
  }
}

/**
 * 500 Internal Server Error
 */
export class InternalServerError extends HttpException {
  constructor(error?: Error) {
    super(
      500, 
      'Internal Server Error', 
      'INTERNAL_SERVER_ERROR',
      process.env.NODE_ENV === 'development' && error 
        ? { message: error.message, stack: error.stack } 
        : undefined
    );
  }
}

/**
 * Global error handler middleware for Next.js API routes
 */
export async function errorHandler(
  error: unknown,
  req: NextRequest,
  res: NextResponse,
  next: () => void
): Promise<NextResponse> {
  // Log the error for debugging
  console.error('API Error:', error);

  // Handle known error types
  if (error instanceof HttpException) {
    const { status, body } = error.toResponse();
    return NextResponse.json(body, { status });
  }

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    const formattedErrors = error.errors.reduce((acc, err) => {
      const path = err.path.join('.');
      return {
        ...acc,
        [path]: err.message,
      };
    }, {});

    const validationError = new ValidationException(formattedErrors);
    const { status, body } = validationError.toResponse();
    return NextResponse.json(body, { status });
  }

  // Handle other types of errors
  const serverError = new InternalServerError(
    error instanceof Error ? error : new Error(String(error))
  );
  const { status, body } = serverError.toResponse();
  
  return NextResponse.json(body, { status });
}

/**
 * Helper to create error responses
 */
export function createErrorResponse(
  status: number,
  message: string,
  code?: string,
  details?: Record<string, any>
): NextResponse {
  const error = new HttpException(status, message, code, details);
  const { body } = error.toResponse();
  return NextResponse.json(body, { status });
}
