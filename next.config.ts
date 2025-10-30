// @ts-check

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable strict mode in development
  reactStrictMode: true,
  
  // Enable TypeScript type checking during build
  typescript: {
    // Set to true to ignore TypeScript errors during build
    ignoreBuildErrors: false,
  },
  
  // Configure webpack
  webpack: (config, { isServer }) => {
    // Add custom webpack configurations here if needed
    return config;
  },
  
  // Configure API route handling
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
    responseLimit: '8mb',
    externalResolver: true,
  },
  
  // Environment variables that should be available to the client
  env: {
    NODE_ENV: process.env.NODE_ENV || 'development',
  },
  
  // Configure headers for API routes
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { 
            key: 'Access-Control-Allow-Methods', 
            value: 'GET, POST, PUT, DELETE, PATCH, OPTIONS' 
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization',
          },
        ],
      },
    ];
  },
  
  // Configure page extensions
  pageExtensions: ['tsx', 'ts', 'jsx', 'js'],
  
  // Configure images
  images: {
    domains: [], // Add external image domains here if needed
  },
  
  // Configure production browser source maps
  productionBrowserSourceMaps: false,
};

// For debugging environment variables
console.log('NODE_ENV:', process.env.NODE_ENV);

export default nextConfig;
