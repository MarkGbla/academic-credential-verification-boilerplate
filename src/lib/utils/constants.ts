export const APP_CONFIG = {
  name: 'Academic Credential Verification',
  version: '1.0.0',
  description: 'Blockchain-based academic credential verification platform',
} as const;

export const SOLANA_CONFIG = {
  network: 'devnet',
  rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
  commitment: 'confirmed',
} as const;

export const AUTH_CONFIG = {
  jwtExpiresIn: '24h',
  bcryptRounds: 12,
  sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
} as const;

export const DATABASE_CONFIG = {
  defaultPageSize: 20,
  maxPageSize: 100,
} as const;

export const CREDENTIAL_CONFIG = {
  defaultExpiryYears: 10,
  maxGPA: 4.0,
  minGPA: 0.0,
} as const;

export const ATTESTATION_CONFIG = {
  maxRetries: 3,
  confirmationTimeout: 30000, // 30 seconds
  retryDelay: 1000, // 1 second
} as const;

export const ERROR_MESSAGES = {
  // Authentication errors
  INVALID_CREDENTIALS: 'Invalid email or password',
  UNAUTHORIZED: 'Authentication required',
  FORBIDDEN: 'Insufficient permissions',
  TOKEN_EXPIRED: 'Authentication token has expired',
  
  // User errors
  USER_NOT_FOUND: 'User not found',
  USER_ALREADY_EXISTS: 'User already exists',
  INVALID_NIN: 'Invalid National Identification Number',
  
  // Credential errors
  CREDENTIAL_NOT_FOUND: 'Credential not found',
  CREDENTIAL_EXPIRED: 'Credential has expired',
  CREDENTIAL_REVOKED: 'Credential has been revoked',
  INVALID_CREDENTIAL_DATA: 'Invalid credential data',
  
  // Attestation errors
  ATTESTATION_NOT_FOUND: 'Attestation not found',
  ATTESTATION_FAILED: 'Failed to create attestation on blockchain',
  ATTESTATION_PENDING: 'Attestation is pending approval',
  INVALID_ATTESTATION_TYPE: 'Invalid attestation type',
  
  // Solana errors
  SOLANA_CONNECTION_ERROR: 'Failed to connect to Solana network',
  INVALID_SOLANA_ADDRESS: 'Invalid Solana address',
  TRANSACTION_FAILED: 'Blockchain transaction failed',
  INSUFFICIENT_BALANCE: 'Insufficient SOL balance for transaction',
  
  // General errors
  INTERNAL_SERVER_ERROR: 'Internal server error',
  VALIDATION_ERROR: 'Validation error',
  NOT_FOUND: 'Resource not found',
  BAD_REQUEST: 'Bad request',
} as const;

export const SUCCESS_MESSAGES = {
  USER_CREATED: 'User created successfully',
  LOGIN_SUCCESS: 'Login successful',
  CREDENTIAL_ISSUED: 'Credential issued successfully',
  ATTESTATION_CREATED: 'Attestation created successfully',
  ATTESTATION_APPROVED: 'Attestation approved successfully',
  CREDENTIAL_VERIFIED: 'Credential verified successfully',
} as const;

export const VALIDATION_RULES = {
  NIN_MIN_LENGTH: 10,
  NIN_MAX_LENGTH: 15,
  PASSWORD_MIN_LENGTH: 8,
  NAME_MIN_LENGTH: 1,
  CODE_MIN_LENGTH: 2,
  TITLE_MIN_LENGTH: 1,
} as const;