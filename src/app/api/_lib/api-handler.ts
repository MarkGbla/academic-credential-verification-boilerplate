import { NextRequest, NextResponse } from 'next/server';

// Define HTTP methods that we support
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS';

// Define the shape of the handler function
type HandlerFunction = (
  req: NextRequest,
  params: Record<string, string>
) => Promise<NextResponse> | NextResponse;

// Define the API handlers type
type ApiHandlers = {
  GET?: HandlerFunction;
  POST?: HandlerFunction;
  PUT?: HandlerFunction;
  PATCH?: HandlerFunction;
  DELETE?: HandlerFunction;
  OPTIONS?: HandlerFunction;
};

// Custom error class for HTTP exceptions
class HttpException extends Error {
  statusCode: number;
  
  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * A higher-order function that creates an API route handler with proper error handling
 * and method validation.
 * 
 * @param handlers An object mapping HTTP methods to their respective handler functions
 * @returns An async function that handles the request
 */
export function apiHandler(handlers: ApiHandlers) {
  return async (req: NextRequest, { params }: { params: Record<string, string> }) => {
    try {
      const method = (req.method || 'GET') as HttpMethod;
      const handler = handlers[method];

      // If no handler for the request method, return 405 Method Not Allowed
      if (!handler) {
        const allowedMethods = Object.keys(handlers)
          .filter(method => handlers[method as HttpMethod] !== undefined)
          .join(', ');
          
        return new NextResponse(
          JSON.stringify({ error: `Method ${method} Not Allowed` }),
          { 
            status: 405, 
            headers: { 
              'Content-Type': 'application/json',
              'Allow': allowedMethods
            } 
          }
        );
      }

      // Check content type for non-GET/DELETE/OPTIONS requests
      if (method !== 'GET' && method !== 'DELETE' && method !== 'OPTIONS') {
        const contentType = req.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new HttpException('Content-Type must be application/json', 415);
        }
      }

      // Execute the handler with the request and params
      return await handler(req, params);
      
    } catch (error) {
      // Handle any uncaught errors
      console.error('API Error:', error);
      
      if (error instanceof HttpException) {
        return new NextResponse(
          JSON.stringify({ error: error.message }),
          { 
            status: error.statusCode, 
            headers: { 'Content-Type': 'application/json' } 
          }
        );
      }
      
      // Handle other errors
      return new NextResponse(
        JSON.stringify({ error: 'Internal Server Error' }),
        { 
          status: 500, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }
  };
}

// Export types for use in route handlers
export type { NextRequest, NextResponse };

// Export HttpException for use in route handlers
export { HttpException };
