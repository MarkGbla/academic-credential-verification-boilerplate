import { IAttestationRepository, ICredentialRepository } from '../database/repositories';
import { AttestationWithRelations } from '../types/attestation';
import { SolanaAttestationService } from '../solana/attestation';
import { ERROR_MESSAGES } from '../utils/constants';

export class AttestationService {
  private solanaService: SolanaAttestationService;

  constructor(
    private attestationRepo: IAttestationRepository,
    private credentialRepo: ICredentialRepository
  ) {
    this.solanaService = new SolanaAttestationService();
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

      // Verify on-chain existence
      const isOnChain = await this.solanaService.verifyAttestation(attestation.solanaAddress);
      if (!isOnChain) {
        return {
          isValid: false,
          error: 'Attestation not found on blockchain',
        };
      }

      // Get on-chain data
      const onChainData = await this.solanaService.getAttestationData(attestation.solanaAddress);

      return {
        isValid: true,
        onChainData,
      };
    } catch (error) {
      return {
        isValid: false,
        error: error.message,
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
    } catch (error) {
      errors.push(error.message);
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
    } catch (error) {
      return {
        isConnected: false,
        authorityBalance: 0,
        error: error.message,
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