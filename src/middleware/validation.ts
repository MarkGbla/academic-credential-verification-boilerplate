import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError, type ZodSchema } from 'zod';
import { ValidationException } from './error-handler';

/**
 * Type for the validation result
 */
type ValidationResult<T> = 
  | { success: true; data: T }
  | { success: false; error: ZodError };

/**
 * Validates request data against a Zod schema
 * @param schema The Zod schema to validate against
 * @param data The data to validate
 * @returns Validation result
 */
export async function validateData<T>(
  schema: ZodSchema<T>,
  data: unknown
): Promise<ValidationResult<T>> {
  try {
    const result = await schema.safeParseAsync(data);
    if (result.success) {
      return { success: true, data: result.data };
    }
    return { success: false, error: result.error };
  } catch (error) {
    if (error instanceof ZodError) {
      return { success: false, error };
    }
    throw error;
  }
}

/**
 * Middleware to validate request body or query parameters
 * @param schema The Zod schema to validate against
 * @param type The type of data to validate ('body' or 'query')
 * @returns Middleware function
 */
export function validateRequest<T>(
  schema: ZodSchema<T>,
  type: 'body' | 'query' = 'body'
) {
  return async (req: NextRequest) => {
    try {
      const data = type === 'query' 
        ? Object.fromEntries(req.nextUrl.searchParams.entries())
        : await req.json().catch(() => ({}));

      const result = await validateData(schema, data);
      
      if (!result.success) {
        const formattedErrors = result.error.errors.reduce<Record<string, string>>(
          (acc, err) => {
            const path = err.path.join('.');
            return {
              ...acc,
              [path]: err.message,
            };
          },
          {}
        );
        
        throw new ValidationException(formattedErrors);
      }
      
      return result.data;
    } catch (error) {
      if (error instanceof ValidationException) {
        throw error;
      }
      throw new Error('Invalid request data');
    }
  };
}

/**
 * Validates query parameters against a Zod schema
 * @param schema The Zod schema to validate against
 * @returns Middleware function
 */
export function validateQueryParams<T>(schema: ZodSchema<T>) {
  return validateRequest(schema, 'query');
}

// Export Zod for convenience
export { z };
