// Type definitions for Next.js

declare module 'next/server' {
  import { RequestInit, Response as NodeResponse } from 'node-fetch';
  
  export interface NextRequest extends Request {
    readonly nextUrl: URL;
    cookies: {
      get(name: string): { name: string; value: string } | undefined;
      getAll(): { name: string; value: string }[];
      set(name: string, value: string): void;
      delete(name: string): void;
    };
    json(): Promise<any>;
    formData(): Promise<FormData>;
  }

  export interface NextResponse extends NodeResponse {
    static json(body: any, init?: ResponseInit): NextResponse;
    static redirect(url: string | URL, init?: number | ResponseInit): NextResponse;
  }
  
  export const NextResponse: {
    json(body: any, init?: ResponseInit): NextResponse;
    redirect(url: string | URL, init?: number | ResponseInit): NextResponse;
  };
}

declare module 'next' {
  import { IncomingMessage, ServerResponse } from 'http';
  
  export interface NextApiRequest extends IncomingMessage {
    query: Partial<{
      [key: string]: string | string[];
    }>;
    cookies: {
      [key: string]: string;
    };
    body: any;
  }
  
  export interface NextApiResponse<T = any> extends ServerResponse {
    status(code: number): this;
    json(data: T): this;
    send(data: any): this;
  }
}

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'production' | 'test';
      DATABASE_URL: string;
      JWT_SECRET: string;
      // Add other environment variables here
    }
  }
}
