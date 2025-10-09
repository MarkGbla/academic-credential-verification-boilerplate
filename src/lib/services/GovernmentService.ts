import { Government, Attestation, GovernmentType } from '@prisma/client';
import { 
  IGovernmentRepository,
  IAttestationRepository,
  ICredentialRepository,
  CreateGovernmentData 
} from '../database/repositories';
import { AttestationRequest, AttestationWithRelations } from '../types/attestation';
import { SolanaAttestationService } from '../solana/attestation';
import { ERROR_MESSAGES } from '../utils/constants';

export interface GovernmentData {
  name: string;
  type: GovernmentType;
  country: string;
  publicKey: string;
  wallet?: string;
}

export class GovernmentService {
  private attestationService: SolanaAttestationService;

  constructor(
    private governmentRepo: IGovernmentRepository,
    private attestationRepo: IAttestationRepository,
    private credentialRepo: ICredentialRepository
  ) {
    this.attestationService = new SolanaAttestationService();
  }

  /**
   * Register a new government entity
   */
  async registerGovernment(data: GovernmentData): Promise<Government> {
    const createData: CreateGovernmentData = {
      name: data.name,
      type: data.type,
      country: data.country,
      publicKey: data.publicKey,
      wallet: data.wallet,
    };

    return this.governmentRepo.create(createData);
  }

  /**
   * Get government entity by ID
   */
  async getGovernmentById(id: string): Promise<Government | null> {
    return this.governmentRepo.findById(id);
  }

  /**
   * Get government entities by type and country
   */
  async getGovernmentsByType(
    type: GovernmentType,
    country?: string
  ): Promise<Government[]> {
    return this.governmentRepo.findByType(type, country);
  }

  /**
   * Get pending accreditation requests for a government entity
   */
  async getPendingRequests(governmentId: string): Promise<AttestationRequest[]> {
    const government = await this.governmentRepo.findById(governmentId);
    if (!government || !government.isActive) {
      throw new Error('Government entity not found or inactive');
    }

    // Get pending attestation requests
    return this.attestationRepo.findPendingByGovernment(governmentId);
  }

  /**
   * Get all attestation requests for a government entity
   */
  async getAllRequests(
    governmentId: string,
    options?: {
      skip?: number;
      take?: number;
      status?: 'PENDING' | 'APPROVED' | 'REJECTED';
    }
  ): Promise<{
    requests: AttestationWithRelations[];
    total: number;
  }> {
    const government = await this.governmentRepo.findById(governmentId);
    if (!government) {
      throw new Error('Government entity not found');
    }

    const where: any = { governmentId };
    if (options?.status) {
      where.status = options.status;
    }

    const [requests, total] = await Promise.all([
      this.attestationRepo.findMany({
        skip: options?.skip,
        take: options?.take,
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

    return { requests, total };
  }

  /**
   * Approve and create attestation for a credential
   */
  async accreditateCredential(
    governmentId: string,
    attestationId: string
  ): Promise<AttestationWithRelations> {
    // Verify government entity exists and is active
    const government = await this.governmentRepo.findById(governmentId);
    if (!government || !government.isActive) {
      throw new Error('Government entity not found or inactive');
    }

    // Get the attestation request
    const attestation = await this.attestationRepo.findByIdWithRelations(attestationId);
    if (!attestation) {
      throw new Error(ERROR_MESSAGES.ATTESTATION_NOT_FOUND);
    }

    // Verify this is a pending government attestation
    if (attestation.attestationType !== 'GOVERNMENT_ACCREDITED' || 
        attestation.status !== 'PENDING') {
      throw new Error('Invalid attestation for approval');
    }

    // Get the original university attestation
    const universityAttestations = await this.attestationRepo.findByCredential(
      attestation.credentialId
    );
    const universityAttestation = universityAttestations.find(
      att => att.attestationType === 'UNIVERSITY_ISSUED'
    );

    if (!universityAttestation) {
      throw new Error('No university attestation found for this credential');
    }

    try {
      // Create government attestation on blockchain
      const { signature, attestationAddress } = await this.attestationService.createGovernmentAttestation(
        attestation.credentialId,
        governmentId,
        universityAttestation.solanaAddress
      );

      // Update the attestation with blockchain data and approve
      const updatedAttestation = await this.attestationRepo.update(attestationId, {
        solanaAddress: attestationAddress,
        governmentId,
        status: 'APPROVED',
      });

      // Also update the transaction hash if needed
      await this.attestationRepo.update(attestationId, {
        status: 'APPROVED',
      });

      return this.attestationRepo.findByIdWithRelations(attestationId) as Promise<AttestationWithRelations>;
    } catch (error) {
      throw new Error(`Failed to create government attestation: ${error.message}`);
    }
  }

  /**
   * Reject an attestation request
   */
  async rejectAccreditation(
    governmentId: string,
    attestationId: string,
    reason?: string
  ): Promise<AttestationWithRelations> {
    // Verify government entity exists and is active
    const government = await this.governmentRepo.findById(governmentId);
    if (!government || !government.isActive) {
      throw new Error('Government entity not found or inactive');
    }

    // Get the attestation request
    const attestation = await this.attestationRepo.findByIdWithRelations(attestationId);
    if (!attestation) {
      throw new Error(ERROR_MESSAGES.ATTESTATION_NOT_FOUND);
    }

    // Verify this is a pending government attestation
    if (attestation.attestationType !== 'GOVERNMENT_ACCREDITED' || 
        attestation.status !== 'PENDING') {
      throw new Error('Invalid attestation for rejection');
    }

    // Update the attestation status to rejected
    await this.attestationRepo.update(attestationId, {
      status: 'REJECTED',
      governmentId,
    });

    return this.attestationRepo.findByIdWithRelations(attestationId) as Promise<AttestationWithRelations>;
  }

  /**
   * Get government entity statistics
   */
  async getGovernmentStats(governmentId: string): Promise<{
    totalRequests: number;
    pendingRequests: number;
    approvedRequests: number;
    rejectedRequests: number;
    requestsByMonth: Record<string, number>;
  }> {
    const government = await this.governmentRepo.findById(governmentId);
    if (!government) {
      throw new Error('Government entity not found');
    }

    const [
      totalRequests,
      pendingRequests,
      approvedRequests,
      rejectedRequests,
      allRequests,
    ] = await Promise.all([
      this.attestationRepo.count({ 
        governmentId,
        attestationType: 'GOVERNMENT_ACCREDITED' 
      }),
      this.attestationRepo.count({ 
        governmentId,
        attestationType: 'GOVERNMENT_ACCREDITED',
        status: 'PENDING' 
      }),
      this.attestationRepo.count({ 
        governmentId,
        attestationType: 'GOVERNMENT_ACCREDITED',
        status: 'APPROVED' 
      }),
      this.attestationRepo.count({ 
        governmentId,
        attestationType: 'GOVERNMENT_ACCREDITED',
        status: 'REJECTED' 
      }),
      this.attestationRepo.findByGovernment(governmentId),
    ]);

    // Calculate requests by month (last 12 months)
    const requestsByMonth = allRequests.reduce((acc, request) => {
      const month = request.createdAt.toISOString().substring(0, 7); // YYYY-MM
      acc[month] = (acc[month] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalRequests,
      pendingRequests,
      approvedRequests,
      rejectedRequests,
      requestsByMonth,
    };
  }

  /**
   * Verify if a credential has government accreditation
   */
  async verifyCredentialAccreditation(credentialId: string): Promise<{
    isAccredited: boolean;
    attestation?: AttestationWithRelations;
    government?: Government;
  }> {
    const attestations = await this.attestationRepo.findByCredentialWithRelations(credentialId);
    
    const governmentAttestation = attestations.find(
      att => att.attestationType === 'GOVERNMENT_ACCREDITED' && att.status === 'APPROVED'
    );

    if (!governmentAttestation) {
      return { isAccredited: false };
    }

    const government = governmentAttestation.government ? 
      await this.governmentRepo.findById(governmentAttestation.government.id) : null;

    return {
      isAccredited: true,
      attestation: governmentAttestation,
      government: government || undefined,
    };
  }

  /**
   * Update government entity information
   */
  async updateGovernment(
    id: string,
    updates: Partial<Omit<GovernmentData, 'type'>>
  ): Promise<Government> {
    const government = await this.governmentRepo.findById(id);
    if (!government) {
      throw new Error('Government entity not found');
    }

    return this.governmentRepo.update(id, updates);
  }

  /**
   * Deactivate government entity
   */
  async deactivateGovernment(id: string): Promise<void> {
    const government = await this.governmentRepo.findById(id);
    if (!government) {
      throw new Error('Government entity not found');
    }

    await this.governmentRepo.update(id, { isActive: false });
  }
}