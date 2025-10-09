import { University, Credential } from '@prisma/client';
import { 
  IUniversityRepository, 
  IStudentRepository,
  ICredentialRepository, 
  IAttestationRepository,
  CreateUniversityData,
  CreateCredentialData 
} from '../database/repositories';
import { CredentialWithRelations, CredentialData } from '../types/credential';
import { SolanaAttestationService } from '../solana/attestation';
import { ERROR_MESSAGES } from '../utils/constants';

export interface UniversityData {
  name: string;
  code: string;
  country: string;
  email: string;
  publicKey: string;
  wallet?: string;
}

export class UniversityService {
  private attestationService: SolanaAttestationService;

  constructor(
    private universityRepo: IUniversityRepository,
    private studentRepo: IStudentRepository,
    private credentialRepo: ICredentialRepository,
    private attestationRepo: IAttestationRepository
  ) {
    this.attestationService = new SolanaAttestationService();
  }

  /**
   * Register a new university
   */
  async registerUniversity(data: UniversityData): Promise<University> {
    // Check if university code already exists
    const existingByCode = await this.universityRepo.findByCode(data.code);
    if (existingByCode) {
      throw new Error('University code already exists');
    }

    // Check if email already exists
    const existingByEmail = await this.universityRepo.findByEmail(data.email);
    if (existingByEmail) {
      throw new Error('Email already registered');
    }

    const createData: CreateUniversityData = {
      name: data.name,
      code: data.code,
      country: data.country,
      email: data.email,
      publicKey: data.publicKey,
      wallet: data.wallet,
    };

    return this.universityRepo.create(createData);
  }

  /**
   * Get university by ID
   */
  async getUniversityById(id: string): Promise<University | null> {
    return this.universityRepo.findById(id);
  }

  /**
   * Get university by code
   */
  async getUniversityByCode(code: string): Promise<University | null> {
    return this.universityRepo.findByCode(code);
  }

  /**
   * Issue a new credential to a student
   */
  async issueCredential(
    universityId: string,
    studentId: string,
    credentialData: CredentialData
  ): Promise<CredentialWithRelations> {
    // Verify university exists and is active
    const university = await this.universityRepo.findById(universityId);
    if (!university || !university.isActive) {
      throw new Error('University not found or inactive');
    }

    // Verify student exists and is active
    const student = await this.studentRepo.findById(studentId);
    if (!student || !student.isActive) {
      throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
    }

    // Create credential record
    const createData: CreateCredentialData = {
      ...credentialData,
      universityId,
      studentId,
    };

    const credential = await this.credentialRepo.create(createData);

    try {
      // Create on-chain attestation
      const solanaAttestationData = {
        credentialId: credential.id,
        universityId: university.id,
        degreeType: credential.degreeType,
        graduationDate: credential.graduationDate.toISOString(),
        metadata: credential.metadata as Record<string, any> || {},
      };

      const { signature, attestationAddress } = await this.attestationService.createUniversityAttestation(
        solanaAttestationData
      );

      // Create attestation record
      await this.attestationRepo.create({
        solanaAddress: attestationAddress,
        transactionHash: signature,
        attestationType: 'UNIVERSITY_ISSUED',
        credentialId: credential.id,
        studentId: student.id,
      });

      // Return credential with relations
      const credentialWithRelations = await this.credentialRepo.findByIdWithRelations(credential.id);
      if (!credentialWithRelations) {
        throw new Error('Failed to fetch created credential');
      }

      return credentialWithRelations;
    } catch (error) {
      // If blockchain operation fails, clean up the credential
      await this.credentialRepo.delete(credential.id);
      throw new Error(`Failed to create attestation: ${error.message}`);
    }
  }

  /**
   * Get all credentials issued by a university
   */
  async getUniversityCredentials(
    universityId: string,
    options?: {
      skip?: number;
      take?: number;
      search?: string;
    }
  ): Promise<{
    credentials: CredentialWithRelations[];
    total: number;
  }> {
    const university = await this.universityRepo.findById(universityId);
    if (!university) {
      throw new Error('University not found');
    }

    // Build search filter
    const where: any = { universityId };
    if (options?.search) {
      where.OR = [
        { title: { contains: options.search, mode: 'insensitive' } },
        { major: { contains: options.search, mode: 'insensitive' } },
        { student: { 
          OR: [
            { firstName: { contains: options.search, mode: 'insensitive' } },
            { lastName: { contains: options.search, mode: 'insensitive' } },
            { email: { contains: options.search, mode: 'insensitive' } },
          ]
        }}
      ];
    }

    const [credentials, total] = await Promise.all([
      this.credentialRepo.findMany({
        skip: options?.skip,
        take: options?.take,
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

    return { credentials, total };
  }

  /**
   * Update credential status (revoke, etc.)
   */
  async updateCredentialStatus(
    universityId: string,
    credentialId: string,
    status: 'ACTIVE' | 'REVOKED' | 'EXPIRED'
  ): Promise<Credential> {
    // Verify university owns the credential
    const credential = await this.credentialRepo.findByIdWithRelations(credentialId);
    if (!credential || credential.university.id !== universityId) {
      throw new Error(ERROR_MESSAGES.CREDENTIAL_NOT_FOUND);
    }

    return this.credentialRepo.updateStatus(credentialId, status);
  }

  /**
   * Get university statistics
   */
  async getUniversityStats(universityId: string): Promise<{
    totalCredentials: number;
    activeCredentials: number;
    revokedCredentials: number;
    credentialsByType: Record<string, number>;
    recentCredentials: CredentialWithRelations[];
  }> {
    const university = await this.universityRepo.findById(universityId);
    if (!university) {
      throw new Error('University not found');
    }

    const [
      totalCredentials,
      activeCredentials,
      revokedCredentials,
      allCredentials,
      recentCredentials,
    ] = await Promise.all([
      this.credentialRepo.count({ universityId }),
      this.credentialRepo.count({ universityId, status: 'ACTIVE' }),
      this.credentialRepo.count({ universityId, status: 'REVOKED' }),
      this.credentialRepo.findByUniversity(universityId),
      this.credentialRepo.findMany({
        where: { universityId },
        take: 5,
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
    ]);

    // Calculate credentials by type
    const credentialsByType = allCredentials.reduce((acc, credential) => {
      acc[credential.degreeType] = (acc[credential.degreeType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalCredentials,
      activeCredentials,
      revokedCredentials,
      credentialsByType,
      recentCredentials,
    };
  }

  /**
   * Update university information
   */
  async updateUniversity(
    id: string,
    updates: Partial<Omit<UniversityData, 'code'>>
  ): Promise<University> {
    const university = await this.universityRepo.findById(id);
    if (!university) {
      throw new Error('University not found');
    }

    // Check email uniqueness if updating email
    if (updates.email && updates.email !== university.email) {
      const existingByEmail = await this.universityRepo.findByEmail(updates.email);
      if (existingByEmail) {
        throw new Error('Email already registered');
      }
    }

    return this.universityRepo.update(id, updates);
  }

  /**
   * Deactivate university
   */
  async deactivateUniversity(id: string): Promise<void> {
    const university = await this.universityRepo.findById(id);
    if (!university) {
      throw new Error('University not found');
    }

    await this.universityRepo.update(id, { isActive: false });
  }
}