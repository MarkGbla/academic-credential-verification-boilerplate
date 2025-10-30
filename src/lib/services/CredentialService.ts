import { NINService } from './NINService';
import { BlockchainService, BlockchainError, TransactionFailedError, TransactionTimeoutError } from './BlockchainService';
import { ICredentialRepository, IAttestationRepository, IUniversityRepository } from '../database/repositories';
import { 
  Credential, 
  CredentialStatus, 
  CredentialType, 
  CredentialWithRelations,
  CreateCredentialData,
  UpdateCredentialData
} from '../types/credential';
import { Attestation, AttestationType } from '../types/attestation';
import { ERROR_MESSAGES } from '../utils/constants';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';

// Events emitted by the CredentialService
export enum CredentialEvent {
  ISSUED = 'credential.issued',
  VERIFIED = 'credential.verified',
  REVOKED = 'credential.revoked',
  EXPIRED = 'credential.expired',
  ERROR = 'credential.error'
}

export interface IssueCredentialParams {
  studentNIN: string;
  universityId: string;
  credentialType: CredentialType;
  metadata: Record<string, any>;
  issuedBy: string; // User ID of the issuer
  expiresAt?: Date; // Optional expiration date
  credentialData: {
    degreeType: string;
    fieldOfStudy: string;
    graduationDate: Date;
    gpa?: number;
    honors?: string[];
  };
}

export interface VerifyCredentialParams {
  credentialId: string;
  studentNIN?: string; // Optional NIN for additional verification
  verifyOnChain?: boolean; // Whether to verify on blockchain
}

export interface RevokeCredentialParams {
  credentialId: string;
  reason: string;
  revokedBy: string; // User ID of the revoker
}

export interface BatchIssueParams {
  credentials: Array<{
    studentNIN: string;
    credentialType: CredentialType;
    metadata: Record<string, any>;
    credentialData: {
      degreeType: string;
      fieldOfStudy: string;
      graduationDate: Date;
      gpa?: number;
      honors?: string[];
    };
  }>;
  universityId: string;
  issuedBy: string;
}

export interface BatchIssueResult {
  success: boolean;
  results: Array<{
    studentNIN: string;
    success: boolean;
    credentialId?: string;
    error?: string;
  }>;
  summary: {
    total: number;
    succeeded: number;
    failed: number;
  };
}

export interface IssueCredentialParams {
  studentNIN: string;
  universityId: string;
  credentialType: CredentialType;
  metadata: Record<string, any>;
  issuedBy: string; // User ID of the issuer
}

export class CredentialService extends EventEmitter {
  private readonly BATCH_SIZE = 10; // Process credentials in batches of 10
  
  constructor(
    private credentialRepo: ICredentialRepository,
    private attestationRepo: IAttestationRepository,
    private universityRepo: IUniversityRepository,
    private blockchainService: BlockchainService,
    private ninService: NINService = new NINService()
  ) {
    super();
    
    // Set max listeners to a higher number to avoid memory leak warnings
    this.setMaxListeners(100);
  }

  /**
   * Issue a new academic credential
   */
  async issueCredential(params: IssueCredentialParams): Promise<{
    success: boolean;
    credential?: CredentialWithRelations;
    error?: string;
  }> {
    // Generate a unique ID for this operation for tracing
    const operationId = uuidv4();
    
    try {
      // 1. Validate university exists and is active
      const university = await this.universityRepo.findById(params.universityId);
      if (!university || !university.isActive) {
        const error = 'University not found or inactive';
        this.emit(CredentialEvent.ERROR, { 
          operationId, 
          error,
          studentNIN: params.studentNIN,
          universityId: params.universityId
        });
        return { success: false, error };
      }

      // 2. Validate NIN and generate address
      const ninValidation = await this.ninService.validateNIN(params.studentNIN);
      if (!ninValidation.isValid) {
        this.emit(CredentialEvent.ERROR, { 
          operationId, 
          error: ninValidation.error || 'Invalid NIN',
          studentNIN: params.studentNIN
        });
        return { 
          success: false, 
          error: ninValidation.error || 'Invalid NIN format' 
        };
      }

      const addressResult = await this.ninService.generateAddress(params.studentNIN);
      if (!addressResult.success || !addressResult.address) {
        const error = addressResult.error || 'Failed to generate student address';
        this.emit(CredentialEvent.ERROR, { 
          operationId, 
          error,
          studentNIN: params.studentNIN
        });
        return { 
          success: false, 
          error
        };
      }

      // 3. Check for existing credentials to prevent duplicates
      const existingCredential = await this.credentialRepo.findOne({
        where: {
          studentNIN: params.studentNIN,
          type: params.credentialType,
          universityId: params.universityId,
          status: {
            not: CredentialStatus.REVOKED
          }
        }
      });

      if (existingCredential) {
        const error = 'A similar active credential already exists for this student';
        this.emit(CredentialEvent.ERROR, { 
          operationId, 
          error,
          studentNIN: params.studentNIN,
          credentialId: existingCredential.id
        });
        return { 
          success: false, 
          error,
          credential: existingCredential as CredentialWithRelations
        };
      }

      // 4. Create credential in database (PENDING status)
      const credentialData: CreateCredentialData = {
        studentNIN: params.studentNIN,
        universityId: params.universityId,
        type: params.credentialType,
        status: CredentialStatus.PENDING,
        metadata: {
          ...params.metadata,
          operationId,
          issuedAt: new Date().toISOString(),
          issuer: {
            id: params.issuedBy,
            name: university.name,
            type: 'UNIVERSITY'
          },
          credentialData: params.credentialData
        },
        issuedBy: params.issuedBy,
        studentAddress: addressResult.address,
        expiresAt: params.expiresAt || this.calculateDefaultExpiry(),
        credentialNumber: this.generateCredentialNumber(params.universityId, params.credentialType)
      };

      const credential = await this.credentialRepo.create(credentialData);

      // 5. Create attestation on the blockchain
      let attestationResult;
      try {
        attestationResult = await this.blockchainService.createAttestation({
          credentialId: credential.id,
          studentId: addressResult.address,
          universityId: params.universityId,
          attestationType: 'UNIVERSITY_ISSUED',
          metadata: {
            ...credential.metadata,
            credentialType: params.credentialType,
            university: {
              id: university.id,
              name: university.name,
              address: university.address,
              accreditation: university.accreditation
            },
            student: {
              nin: params.studentNIN,
              address: addressResult.address
            }
          },
        });

        if (!attestationResult.success) {
          throw new Error(attestationResult.error || 'Failed to create blockchain attestation');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown blockchain error';
        
        // Update credential status to failed
        await this.credentialRepo.update(credential.id, {
          status: CredentialStatus.FAILED,
          error: errorMessage,
          metadata: {
            ...credential.metadata,
            error: errorMessage,
            errorTimestamp: new Date().toISOString()
          }
        });

        this.emit(CredentialEvent.ERROR, { 
          operationId, 
          error: errorMessage,
          studentNIN: params.studentNIN,
          credentialId: credential.id
        });

        return {
          success: false,
          error: `Failed to create blockchain attestation: ${errorMessage}`,
        };
      }

      // 6. Create attestation record in database
      const attestation: Partial<Attestation> = {
        credentialId: credential.id,
        studentNIN: params.studentNIN,
        type: AttestationType.UNIVERSITY_ISSUED,
        status: 'CONFIRMED',
        metadata: {
          transactionId: attestationResult.transactionId,
          attestationAddress: attestationResult.attestationAddress,
          confirmedAt: new Date().toISOString(),
          operationId
        },
        issuedBy: params.issuedBy,
        issuedAt: new Date()
      };

      await this.attestationRepo.create(attestation);

      // 7. Update credential status to ISSUED with blockchain details
      const updateData: UpdateCredentialData = {
        status: CredentialStatus.ISSUED,
        blockchainTxId: attestationResult.transactionId,
        blockchainAddress: attestationResult.attestationAddress,
        metadata: {
          ...credential.metadata,
          blockchain: {
            transactionId: attestationResult.transactionId,
            attestationAddress: attestationResult.attestationAddress,
            confirmedAt: new Date().toISOString()
          },
          issuedAt: new Date().toISOString()
        }
      };

      const updatedCredential = await this.credentialRepo.update(credential.id, updateData);
      const credentialWithRelations = await this.credentialRepo.findByIdWithRelations(credential.id);

      if (!credentialWithRelations) {
        throw new Error('Failed to fetch created credential with relations');
      }

      // 8. Emit success event
      this.emit(CredentialEvent.ISSUED, {
        operationId,
        credential: credentialWithRelations,
        studentNIN: params.studentNIN,
        universityId: params.universityId
      });

      return {
        success: true,
        credential: credentialWithRelations
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to issue credential';
      console.error(`[${operationId}] Credential issuance failed:`, error);
      
      // Update credential status if it was created
      if (credential?.id) {
        try {
          await this.credentialRepo.update(credential.id, {
            status: CredentialStatus.FAILED,
            error: errorMessage,
            metadata: {
              ...credential.metadata,
              error: errorMessage,
              errorTimestamp: new Date().toISOString(),
              operationId
            }
          });
        } catch (dbError) {
          console.error(`[${operationId}] Failed to update failed credential:`, dbError);
        }
      }
      
      // Emit error event
      this.emit(CredentialEvent.ERROR, { 
        operationId, 
        error: errorMessage,
        studentNIN: params.studentNIN,
        universityId: params.universityId,
        credentialId: credential?.id
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Verify a credential's validity
   */
  async verifyCredential(credentialId: string): Promise<{
    isValid: boolean;
    credential?: Credential;
    error?: string;
  }> {
    try {
      const credential = await this.credentialRepo.findById(credentialId);
      if (!credential) {
        return { 
          isValid: false, 
          error: ERROR_MESSAGES.CREDENTIAL_NOT_FOUND 
        };
      }

      // Check if credential is in a valid state
      if (credential.status !== CredentialStatus.ISSUED || !credential.blockchainAddress) {
        return { 
          isValid: false, 
          error: 'Credential is not in a valid state for verification' 
        };
      }

      // Verify on blockchain
      const verification = await this.blockchainService.verifyAttestation(
        credential.blockchainAddress
      );

      if (!verification.isValid) {
        return { 
          isValid: false, 
          error: verification.error || 'Failed to verify credential on blockchain' 
        };
      }

      return { 
        isValid: true, 
        credential: {
          ...credential,
          verificationData: verification.data,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to verify credential';
      return { 
        isValid: false, 
        error: errorMessage 
      };
    }
  }

  /**
   * Revoke a credential
   */
  async revokeCredential(
    credentialId: string, 
    reason: string,
    revokedBy: string
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const credential = await this.credentialRepo.findById(credentialId);
      if (!credential) {
        return { 
          success: false, 
          error: ERROR_MESSAGES.CREDENTIAL_NOT_FOUND 
        };
      }

      if (credential.status === CredentialStatus.REVOKED) {
        return { 
          success: false, 
          error: 'Credential is already revoked' 
        };
      }

      // Update credential status
      await this.credentialRepo.update(credentialId, {
        status: CredentialStatus.REVOKED,
        revokedAt: new Date(),
        revokedBy,
        revocationReason: reason,
      });

      // TODO: Add blockchain transaction to revoke the attestation
      // This would depend on your blockchain implementation

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to revoke credential';
      return { 
        success: false, 
        error: errorMessage 
      };
    }
  }
}
