export class ValidationError extends Error {
  constructor(message: string, public readonly field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized access') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class BlockchainError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly txSignature?: string
  ) {
    super(message);
    this.name = 'BlockchainError';
  }
}

export class TransactionError extends Error {
  constructor(
    message: string,
    public readonly txSignature?: string,
    public readonly logs?: string[]
  ) {
    super(message);
    this.name = 'TransactionError';
  }
}

export const ERROR_MESSAGES = {
  INVALID_INPUT: 'Invalid input provided',
  CREDENTIAL_NOT_FOUND: 'Credential not found',
  CREDENTIAL_REVOKED: 'Credential has been revoked',
  CREDENTIAL_EXPIRED: 'Credential has expired',
  UNAUTHORIZED: 'Unauthorized access',
  BLOCKCHAIN_ERROR: 'Blockchain operation failed',
  TRANSACTION_FAILED: 'Transaction failed',
  VALIDATION_ERROR: 'Validation error',
} as const;
