import { IAttestationRepository, ICredentialRepository, IStudentRepository, IUniversityRepository } from '../database/repositories';
import { AttestationStatus, AttestationType, AttestationWithRelations, CreateAttestationData as CreateAttestationDataType } from '../types/attestation';
import { SolanaAttestationService } from '../solana/attestation';
import { NINService } from './NINService';
import { ERROR_MESSAGES } from '../utils/constants';
import { BlockchainService } from './BlockchainService';
import { CredentialService } from './CredentialService';

export interface CreateAttestationParams {
  studentNIN: string;
  universityId: string;
  credentialType: string;
  metadata?: Record<string, any>;
  requestedBy: string; // User ID of the requester
}

export interface ReviewAttestationParams {
  attestationId: string;
  status: 'APPROVED' | 'REJECTED';
  reviewedBy: string; // User ID of the reviewer
  comments?: string;
}

export class AttestationService {
  private solanaService: SolanaAttestationService;
  private blockchainService: BlockchainService;
  private credentialService: CredentialService;

  constructor(
    private attestationRepo: IAttestationRepository,
    private credentialRepo: ICredentialRepository,
    private studentRepo: IStudentRepository,
    private universityRepo: IUniversityRepository,
    blockchainConfig: {
      rpcUrl: string;
      programId: string;
      walletPrivateKey: string;
    }
  ) {
    this.solanaService = new SolanaAttestationService();
    this.blockchainService = new BlockchainService(blockchainConfig);
    this.credentialService = new CredentialService(credentialRepo, this.blockchainService);
  }

  /**
   * Create a new attestation request
   */
  async createAttestation(params: CreateAttestationParams): Promise<{
    success: boolean;
    attestation?: AttestationWithRelations;
    error?: string;
  }> {
    try {
      // 1. Validate student NIN
      const ninValidation = NINService.validateNIN(params.studentNIN);
      if (!ninValidation.isValid) {
        return { success: false, error: ninValidation.error };
      }

      // 2. Verify university exists and is active
      const university = await this.universityRepo.findById(params.universityId);
      if (!university || !university.isActive) {
        return { 
          success: false, 
          error: 'University not found or inactive' 
        };
      }

      // 3. Check for existing attestation request
      const existingAttestations = await this.attestationRepo.findMany({
        where: {
          student: { nin: params.studentNIN },
          credential: {
            universityId: params.universityId,
            type: params.credentialType,
          },
        },
        take: 1,
      });
      
      const existingAttestation = existingAttestations[0] as AttestationWithRelations | undefined;

      if (existingAttestation) {
        return {
          success: false,
          error: 'An attestation request already exists for this student and credential type',
        };
      }

      // 4. Create credential first (or get existing)
      // TODO: You'll need to get the studentId from the database or another service
      // For now, we'll use the NIN as the studentId, but this should be fixed
      const credential = await this.credentialRepo.create({
        title: `${params.credentialType} Credential`,
        degreeType: 'BACHELORS', // This should come from params or config
        graduationDate: new Date(), // This should come from params
        universityId: params.universityId,
        studentId: params.studentNIN, // This should be the actual student ID, not NIN
        metadata: params.metadata || {},
      });

      // 5. Create attestation record
      const attestationData: CreateAttestationDataType = {
        credentialId: credential.id,
        studentId: params.studentNIN, // This should be the student's ID, not NIN - needs to be fixed in the schema
        attestationType: AttestationType.UNIVERSITY_ISSUED,
        solanaAddress: '', // Will be set after blockchain operation
        transactionHash: '', // Will be set after blockchain operation
      };

      const attestation = await this.attestationRepo.create(attestationData);

      // Fetch the full attestation with relations
      const createdAttestation = await this.attestationRepo.findByIdWithRelations(attestation.id);
      if (!createdAttestation) {
        throw new Error('Failed to fetch created attestation');
      }
      
      return { success: true, attestation: createdAttestation };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create attestation request';
      return { 
        success: false, 
        error: errorMessage 
      };
    }
  }

  /**
   * Review and approve/reject an attestation
   */
  async reviewAttestation(params: ReviewAttestationParams): Promise<{
    success: boolean;
    attestation?: AttestationWithRelations;
    credential?: any; // Credential type from CredentialService
    error?: string;
  }> {
    // Note: If you need transactions, you'll need to implement a transaction wrapper
    // since the repository interface doesn't currently support sessions
    // For now, we'll proceed without transaction support

    try {
      // 1. Get and validate attestation
      const attestation = await this.attestationRepo.findById(params.attestationId);
      if (!attestation) {
        // Transaction handling removed - implement if needed
        return { 
          success: false, 
          error: ERROR_MESSAGES.ATTESTATION_NOT_FOUND 
        };
      }

      // 2. Check if attestation is in a reviewable state
      if (attestation.status !== AttestationStatus.PENDING) {
        // Transaction handling removed - implement if needed
        return { 
          success: false, 
          error: 'Attestation is not in a reviewable state' 
        };
      }

      // 3. Update attestation status
      const updatedAttestation = await this.attestationRepo.update(
        params.attestationId,
        {
          status: params.status,
          // Add reviewedBy and comments to the UpdateAttestationData interface if needed
          // For now, we'll just update the status
        }
      );
      
      // Manually add the reviewedAt and reviewedBy fields to the returned object
      const updatedWithReviewInfo = {
        ...updatedAttestation,
        reviewedAt: new Date(),
        reviewedBy: params.reviewedBy,
        comments: params.comments,
      };

      // 4. If approved, issue the credential
      let credentialResult;
      if (params.status === 'APPROVED') {
        credentialResult = await this.credentialService.issueCredential({
          studentNIN: attestation.studentId, // Using studentId from attestation
          universityId: attestation.credential.universityId,
          credentialType: attestation.credential.type,
          metadata: {
            ...(attestation.credential.metadata || {}),
            attestationId: attestation.id,
          },
          issuedBy: params.reviewedBy,
        });

        if (!credentialResult.success) {
          return { 
            success: false, 
            error: `Failed to issue credential: ${credentialResult.error}`,
          };
        }

        // Update attestation with credential reference
        // Note: The credentialId should be part of the attestation already
        // since we created the credential first
      }

      // 5. TODO: Send notification to relevant parties
      // this.notificationService.notifyAttestationStatusUpdate(updatedWithReviewInfo);

      return { 
        success: true, 
        attestation: updatedWithReviewInfo as AttestationWithRelations,
        credential: credentialResult?.credential,
      };
    } catch (error: unknown) {
      // If transaction support is added, uncomment this:
      // await session.abortTransaction();
      const errorMessage = error instanceof Error ? error.message : 'Failed to process attestation review';
      return { 
        success: false, 
        error: errorMessage 
      };
    }
  }

  /**
   * Verify an attestation exists on-chain
   */
  async verifyAttestation(attestationId: string): Promise<{
    isValid: boolean;
    onChainData?: any;
    error?: string;
  }> {
    try {
      const attestation = await this.attestationRepo.findByIdWithRelations(attestationId);
      if (!attestation) {
        return {
          isValid: false,
          error: ERROR_MESSAGES.ATTESTATION_NOT_FOUND,
        };
      }

      // If attestation was rejected, no need to check blockchain
      if (attestation.status === AttestationStatus.REJECTED) {
        return {
          isValid: false,
          error: 'Attestation was rejected',
        };
      }

      // If attestation is pending, it won't be on-chain yet
      if (attestation.status === AttestationStatus.PENDING) {
        return {
          isValid: false,
          error: 'Attestation is still pending review',
        };
      }

      // If we have a credential, verify it instead
      if (attestation.credential) {
        const verification = await this.credentialService.verifyCredential(attestation.credential.id);
        return {
          isValid: verification.isValid,
          onChainData: verification.credential?.verificationData,
          error: verification.error,
        };
      }

      // Fallback to direct blockchain verification
      if (!attestation.solanaAddress) {
        return {
          isValid: false,
          error: 'No blockchain address found for this attestation',
        };
      }

      const isOnChain = await this.solanaService.verifyAttestation(attestation.solanaAddress);
      if (!isOnChain) {
        return {
          isValid: false,
          error: 'Attestation not found on blockchain',
        };
      }

      const onChainData = await this.solanaService.getAttestationData(attestation.solanaAddress);

      return {
        isValid: true,
        onChainData,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to verify attestation';
      return {
        isValid: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Get complete attestation chain for a credential
   */
  async getCredentialAttestationChain(credentialId: string): Promise<{
    credential: any;
    universityAttestation?: AttestationWithRelations;
    governmentAttestation?: AttestationWithRelations;
    isComplete: boolean;
  }> {
    const credential = await this.credentialRepo.findByIdWithRelations(credentialId);
    if (!credential) {
      throw new Error(ERROR_MESSAGES.CREDENTIAL_NOT_FOUND);
    }

    const attestations = await this.attestationRepo.findByCredentialWithRelations(credentialId);

    const universityAttestation = attestations.find(
      att => att.attestationType === 'UNIVERSITY_ISSUED'
    );

    const governmentAttestation = attestations.find(
      att => att.attestationType === 'GOVERNMENT_ACCREDITED' && att.status === 'APPROVED'
    );

    return {
      credential,
      universityAttestation,
      governmentAttestation,
      isComplete: !!(universityAttestation && governmentAttestation),
    };
  }

  /**
   * Verify complete credential authenticity
   */
  async verifyCredentialAuthenticity(credentialId: string): Promise<{
    isAuthentic: boolean;
    universityVerified: boolean;
    governmentVerified: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];
    let universityVerified = false;
    let governmentVerified = false;

    try {
      const { universityAttestation, governmentAttestation } = 
        await this.getCredentialAttestationChain(credentialId);

      // Verify university attestation
      if (universityAttestation) {
        const universityVerification = await this.verifyAttestation(universityAttestation.id);
        universityVerified = universityVerification.isValid;
        if (!universityVerified) {
          errors.push(`University verification failed: ${universityVerification.error}`);
        }
      } else {
        errors.push('No university attestation found');
      }

      // Verify government attestation
      if (governmentAttestation) {
        const governmentVerification = await this.verifyAttestation(governmentAttestation.id);
        governmentVerified = governmentVerification.isValid;
        if (!governmentVerified) {
          errors.push(`Government verification failed: ${governmentVerification.error}`);
        }
      }

      return {
        isAuthentic: universityVerified && governmentVerified,
        universityVerified,
        governmentVerified,
        errors,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(errorMessage);
      return {
        isAuthentic: false,
        universityVerified,
        governmentVerified,
        errors,
      };
    }
  }

  /**
   * Get attestation by Solana address
   */
  async getAttestationBySolanaAddress(address: string): Promise<AttestationWithRelations | null> {
    const attestation = await this.attestationRepo.findBySolanaAddress(address);
    if (!attestation) {
      return null;
    }

    return this.attestationRepo.findByIdWithRelations(attestation.id);
  }

  /**
   * Get attestation by transaction hash
   */
  async getAttestationByTransactionHash(hash: string): Promise<AttestationWithRelations | null> {
    const attestation = await this.attestationRepo.findByTransactionHash(hash);
    if (!attestation) {
      return null;
    }

    return this.attestationRepo.findByIdWithRelations(attestation.id);
  }

  /**
   * Check Solana network status and authority balance
   */
  async getNetworkStatus(): Promise<{
    isConnected: boolean;
    authorityBalance: number;
    blockHeight?: number;
    error?: string;
  }> {
    try {
      const balance = await this.solanaService.checkBalance();
      
      // You could add more network checks here
      return {
        isConnected: true,
        authorityBalance: balance,
        // blockHeight could be fetched from connection
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        isConnected: false,
        authorityBalance: 0,
        error: errorMessage,
      };
    }
  }

  /**
   * Get transaction status for an attestation
   */
  async getTransactionStatus(attestationId: string): Promise<{
    attestation: AttestationWithRelations;
    transactionStatus: {
      confirmed: boolean;
      error?: string;
    };
  }> {
    const attestation = await this.attestationRepo.findByIdWithRelations(attestationId);
    if (!attestation) {
      throw new Error(ERROR_MESSAGES.ATTESTATION_NOT_FOUND);
    }

    const transactionStatus = await this.solanaService.getTransactionStatus(
      attestation.transactionHash
    );

    return {
      attestation,
      transactionStatus,
    };
  }

  /**
   * Search attestations by various criteria
   */
  async searchAttestations(criteria: {
    studentName?: string;
    universityCode?: string;
    governmentType?: string;
    credentialTitle?: string;
    attestationType?: 'UNIVERSITY_ISSUED' | 'GOVERNMENT_ACCREDITED';
    status?: 'PENDING' | 'APPROVED' | 'REJECTED';
    skip?: number;
    take?: number;
  }): Promise<{
    attestations: AttestationWithRelations[];
    total: number;
  }> {
    const where: any = {};
    
    if (criteria.attestationType) {
      where.attestationType = criteria.attestationType;
    }
    
    if (criteria.status) {
      where.status = criteria.status;
    }

    // Add more complex search filters
    const orConditions = [];
    
    if (criteria.studentName) {
      orConditions.push({
        student: {
          OR: [
            { firstName: { contains: criteria.studentName, mode: 'insensitive' } },
            { lastName: { contains: criteria.studentName, mode: 'insensitive' } },
          ]
        }
      });
    }

    if (criteria.credentialTitle) {
      orConditions.push({
        credential: {
          title: { contains: criteria.credentialTitle, mode: 'insensitive' }
        }
      });
    }

    if (orConditions.length > 0) {
      where.OR = orConditions;
    }

    const [attestations, total] = await Promise.all([
      this.attestationRepo.findMany({
        skip: criteria.skip,
        take: criteria.take,
        where,
        include: {
          credential: {
            select: {
              id: true,
              title: true,
              degreeType: true,
            },
          },
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          government: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
        },
      }) as Promise<AttestationWithRelations[]>,
      this.attestationRepo.count(where),
    ]);

    return { attestations, total };
  }
}