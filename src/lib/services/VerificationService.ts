import { ICredentialRepository, IAttestationRepository } from '../database/repositories';
import { CredentialWithRelations } from '../types/credential';
import { AttestationService } from './AttestationService';
import { 
  ERROR_MESSAGES,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  BlockchainError,
  TransactionError
} from '../errors';
import { PrismaClient } from '@prisma/client';

export interface VerificationOptions {
  requireGovernmentApproval?: boolean;
  checkExpiration?: boolean;
  verifyOnChain?: boolean;
  maxRetries?: number;
  retryDelay?: number;
}

export interface VerificationResult {
  isValid: boolean;
  credential?: CredentialWithRelations;
  verificationDetails: {
    credentialExists: boolean;
    credentialActive: boolean;
    universityVerified: boolean;
    governmentAccredited: boolean;
    blockchainVerified: boolean;
  };
  errors: string[];
  verifiedAt: Date;
}

export class VerificationService {
  private readonly maxRetries: number;
  private readonly retryDelay: number;

  constructor(
    private readonly credentialRepo: ICredentialRepository,
    private readonly attestationRepo: IAttestationRepository,
    private readonly attestationService: AttestationService,
    private readonly prisma: PrismaClient,
    options: VerificationOptions = {}
  ) {
    this.maxRetries = options.maxRetries ?? 3;
    this.retryDelay = options.retryDelay ?? 1000; // 1 second
  }

  /**
   * Verify a credential by ID with retry logic
   */
  private async withRetry<T>(
    operation: () => Promise<T>,
    errorMessage: string,
    retryCount = 0
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (retryCount >= this.maxRetries) {
        throw new Error(`${errorMessage} after ${this.maxRetries} attempts: ${error.message}`);
      }
      
      // Exponential backoff
      const delay = this.retryDelay * Math.pow(2, retryCount);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      return this.withRetry(operation, errorMessage, retryCount + 1);
    }
  }

  /**
   * Verify a credential by ID (public verification)
   * @param credentialId The ID of the credential to verify
   * @param options Verification options
   * @returns Verification result with detailed status
   */
  async verifyCredential(
    credentialId: string,
    options: VerificationOptions = {}
  ): Promise<VerificationResult> {
    const errors: string[] = [];
    const verificationDetails = {
      credentialExists: false,
      credentialActive: false,
      universityVerified: false,
      governmentAccredited: false,
      blockchainVerified: false,
    };

    // Use transaction for atomic operations
    return this.prisma.$transaction(async (tx) => {
      try {
        // Check if credential exists
        const credential = await this.credentialRepo.findByIdWithRelations(credentialId);
        if (!credential) {
          throw new NotFoundError(ERROR_MESSAGES.CREDENTIAL_NOT_FOUND);
        }

        verificationDetails.credentialExists = true;

        // Check if credential is active
        if (credential.status === 'REVOKED') {
          throw new ValidationError(ERROR_MESSAGES.CREDENTIAL_REVOKED);
        }

        // Check expiration if enabled
        if (options.checkExpiration !== false) {
          const now = new Date();
          if (credential.status === 'EXPIRED' || 
              (credential.expiryDate && credential.expiryDate < now)) {
            throw new ValidationError(ERROR_MESSAGES.CREDENTIAL_EXPIRED);
          }
        }
        verificationDetails.credentialActive = true;

        // Verify attestation chain with retry logic
        const authenticity = await this.withRetry(
          () => this.attestationService.verifyCredentialAuthenticity(credentialId),
          'Failed to verify credential authenticity'
        );
        
        verificationDetails.universityVerified = authenticity.universityVerified;
        verificationDetails.governmentAccredited = authenticity.governmentVerified;
        verificationDetails.blockchainVerified = authenticity.isAuthentic;

        if (authenticity.errors.length > 0) {
          errors.push(...authenticity.errors);
        }

        // Additional verification if required
        if (options.verifyOnChain) {
          // Implement on-chain verification logic here
          // This would involve checking the blockchain state
        }

        const isValid = verificationDetails.credentialExists &&
                        verificationDetails.credentialActive &&
                        verificationDetails.universityVerified &&
                        verificationDetails.blockchainVerified &&
                        (options.requireGovernmentApproval ? 
                          verificationDetails.governmentAccredited : true);

        return {
          isValid,
          credential,
          verificationDetails,
          errors: errors.length > 0 ? errors : undefined,
          verifiedAt: new Date(),
        };

      } catch (error) {
        // Handle specific error types
        if (error instanceof ValidationError || 
            error instanceof NotFoundError || 
            error instanceof UnauthorizedError) {
          errors.push(error.message);
        } else if (error instanceof BlockchainError || 
                  error instanceof TransactionError) {
          errors.push(`${ERROR_MESSAGES.BLOCKCHAIN_ERROR}: ${error.message}`);
          // Log additional details for blockchain errors
          console.error('Blockchain error details:', {
            code: error['code'],
            txSignature: error['txSignature'],
            logs: error['logs']
          });
        } else {
          // For unexpected errors, log the full error but return a generic message
          console.error('Unexpected error during verification:', error);
          errors.push('An unexpected error occurred during verification');
        }

        return {
          isValid: false,
          verificationDetails,
          errors,
          verifiedAt: new Date(),
        };
      }
    });
  }

  /**
   * Quick verification (basic checks only)
   */
  async quickVerifyCredential(credentialId: string): Promise<{
    isValid: boolean;
    status: 'VALID' | 'INVALID' | 'REVOKED' | 'EXPIRED' | 'NOT_FOUND';
    credential?: {
      id: string;
      title: string;
      degreeType: string;
      university: string;
      student: string;
      issuanceDate: Date;
    };
  }> {
    try {
      const credential = await this.credentialRepo.findByIdWithRelations(credentialId);
      
      if (!credential) {
        return {
          isValid: false,
          status: 'NOT_FOUND',
        };
      }

      if (credential.status === 'REVOKED') {
        return {
          isValid: false,
          status: 'REVOKED',
          credential: {
            id: credential.id,
            title: credential.title,
            degreeType: credential.degreeType,
            university: credential.university.name,
            student: `${credential.student.firstName} ${credential.student.lastName}`,
            issuanceDate: credential.issuanceDate,
          },
        };
      }

      if (credential.status === 'EXPIRED' || 
          (credential.expiryDate && credential.expiryDate < new Date())) {
        return {
          isValid: false,
          status: 'EXPIRED',
          credential: {
            id: credential.id,
            title: credential.title,
            degreeType: credential.degreeType,
            university: credential.university.name,
            student: `${credential.student.firstName} ${credential.student.lastName}`,
            issuanceDate: credential.issuanceDate,
          },
        };
      }

      return {
        isValid: true,
        status: 'VALID',
        credential: {
          id: credential.id,
          title: credential.title,
          degreeType: credential.degreeType,
          university: credential.university.name,
          student: `${credential.student.firstName} ${credential.student.lastName}`,
          issuanceDate: credential.issuanceDate,
        },
      };

    } catch (error) {
      return {
        isValid: false,
        status: 'INVALID',
      };
    }
  }

  /**
   * Batch verify multiple credentials
   */
  async batchVerifyCredentials(
    credentialIds: string[],
    options: VerificationOptions = {}
  ): Promise<{ [credentialId: string]: VerificationResult }> {
    // Process verifications in parallel with a concurrency limit
    const BATCH_SIZE = 5;
    const results: { [credentialId: string]: VerificationResult } = {};
    };
  }> {
    const results = await Promise.all(
      credentialIds.map(async (credentialId) => ({
        credentialId,
        result: await this.verifyCredential(credentialId),
      }))
    );

    const summary = {
      total: results.length,
      valid: results.filter(r => r.result.isValid).length,
      invalid: results.filter(r => !r.result.isValid).length,
    };

    return { results, summary };
  }

  /**
   * Generate verification report
   */
  async generateVerificationReport(credentialId: string): Promise<{
    credential: CredentialWithRelations | null;
    verification: VerificationResult;
    attestationChain: any;
    reportId: string;
    generatedAt: Date;
  }> {
    const [verification, attestationChain] = await Promise.all([
      this.verifyCredential(credentialId),
      this.attestationService.getCredentialAttestationChain(credentialId).catch(() => null),
    ]);

    return {
      credential: verification.credential || null,
      verification,
      attestationChain,
      reportId: `VR-${Date.now()}-${credentialId.slice(-8)}`,
      generatedAt: new Date(),
    };
  }

  /**
   * Get verification statistics
   */
  async getVerificationStats(dateRange?: {
    from: Date;
    to: Date;
  }): Promise<{
    totalCredentials: number;
    activeCredentials: number;
    revokedCredentials: number;
    expiredCredentials: number;
    recentVerifications: number;
  }> {
    const whereClause = dateRange ? {
      createdAt: {
        gte: dateRange.from,
        lte: dateRange.to,
      }
    } : {};

    const [
      totalCredentials,
      activeCredentials,
      revokedCredentials,
      expiredCredentials,
    ] = await Promise.all([
      this.credentialRepo.count(whereClause),
      this.credentialRepo.count({ ...whereClause, status: 'ACTIVE' }),
      this.credentialRepo.count({ ...whereClause, status: 'REVOKED' }),
      this.credentialRepo.count({ ...whereClause, status: 'EXPIRED' }),
    ]);

    return {
      totalCredentials,
      activeCredentials,
      revokedCredentials,
      expiredCredentials,
      recentVerifications: 0, // This would require a verification log table
    };
  }

  /**
   * Search and verify credentials by student name or university
   */
  async searchAndVerifyCredentials(query: {
    studentName?: string;
    universityCode?: string;
    degreeType?: string;
    skip?: number;
    take?: number;
  }): Promise<{
    credentials: Array<{
      credential: CredentialWithRelations;
      quickVerification: {
        isValid: boolean;
        status: string;
      };
    }>;
    total: number;
  }> {
    const where: any = { status: 'ACTIVE' };
    
    if (query.degreeType) {
      where.degreeType = query.degreeType;
    }

    if (query.studentName || query.universityCode) {
      const orConditions = [];
      
      if (query.studentName) {
        orConditions.push({
          student: {
            OR: [
              { firstName: { contains: query.studentName, mode: 'insensitive' } },
              { lastName: { contains: query.studentName, mode: 'insensitive' } },
            ]
          }
        });
      }

      if (query.universityCode) {
        orConditions.push({
          university: {
            code: { contains: query.universityCode, mode: 'insensitive' }
          }
        });
      }

      where.OR = orConditions;
    }

    const [credentials, total] = await Promise.all([
      this.credentialRepo.findMany({
        skip: query.skip,
        take: query.take,
        where,
        include: {
          university: {
            select: {
              id: true,
              name: true,
              code: true,
              country: true,
            },
          },
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          attestations: {
            select: {
              id: true,
              solanaAddress: true,
              transactionHash: true,
              attestationType: true,
              status: true,
            },
          },
        },
      }) as Promise<CredentialWithRelations[]>,
      this.credentialRepo.count(where),
    ]);

    // Quick verify each credential
    const results = await Promise.all(
      credentials.map(async (credential) => {
        const quickVerification = await this.quickVerifyCredential(credential.id);
        return {
          credential,
          quickVerification: {
            isValid: quickVerification.isValid,
            status: quickVerification.status,
          },
        };
      })
    );

    return {
      credentials: results,
      total,
    };
  }
}