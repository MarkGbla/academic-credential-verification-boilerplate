import { NextResponse } from 'next/server';

type SuccessResponse<T = any> = {
  success: true;
  data: T;
  meta?: Record<string, any>;
};

type ErrorResponse = {
  success: false;
  error: {
    message: string;
    code?: string;
    details?: Record<string, any>;
  };
};

export type ApiResponse<T = any> = SuccessResponse<T> | ErrorResponse;

export const successResponse = <T = any>(
  data: T,
  meta?: Record<string, any>,
  status = 200
): NextResponse<ApiResponse<T>> => {
  return NextResponse.json(
    {
      success: true,
      data,
      ...(meta && { meta }),
    },
    { status }
  );
};

export const errorResponse = (
  message: string,
  status = 400,
  code?: string,
  details?: Record<string, any>
): NextResponse<ApiResponse> => {
  return NextResponse.json(
    {
      success: false,
      error: {
        message,
        ...(code && { code }),
        ...(details && { details }),
      },
    },
    { status }
  );
};

// Common error responses
export const notFoundResponse = (entity: string) =>
  errorResponse(`${entity} not found`, 404, 'NOT_FOUND');

export const unauthorizedResponse = () =>
  errorResponse('Unauthorized', 401, 'UNAUTHORIZED');

export const forbiddenResponse = () =>
  errorResponse('Forbidden', 403, 'FORBIDDEN');

export const validationErrorResponse = (errors: Record<string, any>) =>
  errorResponse('Validation failed', 400, 'VALIDATION_ERROR', { errors });

export const serverErrorResponse = (error: Error) =>
  errorResponse(
    'Internal server error',
    500,
    'INTERNAL_SERVER_ERROR',
    process.env.NODE_ENV === 'development' ? { error: error.message } : undefined
  );
