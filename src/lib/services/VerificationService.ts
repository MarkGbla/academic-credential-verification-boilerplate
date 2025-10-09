import { ICredentialRepository, IAttestationRepository } from '../database/repositories';
import { CredentialWithRelations } from '../types/credential';
import { AttestationService } from './AttestationService';
import { ERROR_MESSAGES } from '../utils/constants';

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
  constructor(
    private credentialRepo: ICredentialRepository,
    private attestationRepo: IAttestationRepository,
    private attestationService: AttestationService
  ) {}

  /**
   * Verify a credential by ID (public verification)
   */
  async verifyCredential(credentialId: string): Promise<VerificationResult> {
    const errors: string[] = [];
    const verificationDetails = {
      credentialExists: false,
      credentialActive: false,
      universityVerified: false,
      governmentAccredited: false,
      blockchainVerified: false,
    };

    try {
      // Check if credential exists
      const credential = await this.credentialRepo.findByIdWithRelations(credentialId);
      if (!credential) {
        errors.push(ERROR_MESSAGES.CREDENTIAL_NOT_FOUND);
        return {
          isValid: false,
          verificationDetails,
          errors,
          verifiedAt: new Date(),
        };
      }

      verificationDetails.credentialExists = true;

      // Check if credential is active
      if (credential.status === 'REVOKED') {
        errors.push(ERROR_MESSAGES.CREDENTIAL_REVOKED);
      } else if (credential.status === 'EXPIRED' || 
                 (credential.expiryDate && credential.expiryDate < new Date())) {
        errors.push(ERROR_MESSAGES.CREDENTIAL_EXPIRED);
      } else {
        verificationDetails.credentialActive = true;
      }

      // Verify attestation chain
      const authenticity = await this.attestationService.verifyCredentialAuthenticity(credentialId);
      
      verificationDetails.universityVerified = authenticity.universityVerified;
      verificationDetails.governmentAccredited = authenticity.governmentVerified;
      verificationDetails.blockchainVerified = authenticity.isAuthentic;

      if (authenticity.errors.length > 0) {
        errors.push(...authenticity.errors);
      }

      const isValid = verificationDetails.credentialExists &&
                      verificationDetails.credentialActive &&
                      verificationDetails.universityVerified &&
                      verificationDetails.blockchainVerified;

      return {
        isValid,
        credential,
        verificationDetails,
        errors,
        verifiedAt: new Date(),
      };

    } catch (error) {
      errors.push(`Verification failed: ${error.message}`);
      return {
        isValid: false,
        verificationDetails,
        errors,
        verifiedAt: new Date(),
      };
    }
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
  async batchVerifyCredentials(credentialIds: string[]): Promise<{
    results: Array<{
      credentialId: string;
      result: VerificationResult;
    }>;
    summary: {
      total: number;
      valid: number;
      invalid: number;
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