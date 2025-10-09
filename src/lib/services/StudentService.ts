import { Student } from '@prisma/client';
import { 
  IStudentRepository, 
  ICredentialRepository, 
  IAttestationRepository,
  CreateStudentData 
} from '../database/repositories';
import { CredentialWithRelations } from '../types/credential';
import { AttestationRequest } from '../types/attestation';
import { hashNIN, generateAddressFromNIN } from '../utils/crypto';
import { validateNIN } from '../utils/validation';
import { ERROR_MESSAGES } from '../utils/constants';

export interface StudentData {
  firstName: string;
  lastName: string;
  email: string;
  wallet?: string;
}

export class StudentService {
  constructor(
    private studentRepo: IStudentRepository,
    private credentialRepo: ICredentialRepository,
    private attestationRepo: IAttestationRepository
  ) {}

  /**
   * Register a new student with NIN-based identity
   */
  async registerStudent(nin: string, userData: StudentData): Promise<Student> {
    // Validate NIN format
    if (!validateNIN(nin)) {
      throw new Error(ERROR_MESSAGES.INVALID_NIN);
    }

    // Hash NIN for privacy
    const ninHash = hashNIN(nin);
    
    // Check if student already exists
    const existingStudent = await this.studentRepo.findByNinHash(ninHash);
    if (existingStudent) {
      throw new Error(ERROR_MESSAGES.USER_ALREADY_EXISTS);
    }

    // Check if email already exists
    const existingByEmail = await this.studentRepo.findByEmail(userData.email);
    if (existingByEmail) {
      throw new Error('Email already registered');
    }

    // Generate deterministic Solana address from NIN
    const solanaAddress = generateAddressFromNIN(nin);

    // Create student record
    const createData: CreateStudentData = {
      ninHash,
      solanaAddress,
      firstName: userData.firstName,
      lastName: userData.lastName,
      email: userData.email,
      wallet: userData.wallet,
    };

    return this.studentRepo.create(createData);
  }

  /**
   * Get student by ID
   */
  async getStudentById(id: string): Promise<Student | null> {
    return this.studentRepo.findById(id);
  }

  /**
   * Get student by email
   */
  async getStudentByEmail(email: string): Promise<Student | null> {
    return this.studentRepo.findByEmail(email);
  }

  /**
   * Verify student identity using NIN
   */
  async verifyStudentIdentity(id: string, nin: string): Promise<boolean> {
    const student = await this.studentRepo.findById(id);
    if (!student) {
      return false;
    }

    const ninHash = hashNIN(nin);
    return student.ninHash === ninHash;
  }

  /**
   * Get all credentials for a student
   */
  async getStudentCredentials(studentId: string): Promise<CredentialWithRelations[]> {
    const student = await this.studentRepo.findById(studentId);
    if (!student) {
      throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
    }

    return this.credentialRepo.findByStudentWithRelations(studentId);
  }

  /**
   * Get student's credential by ID
   */
  async getStudentCredential(
    studentId: string, 
    credentialId: string
  ): Promise<CredentialWithRelations | null> {
    const credential = await this.credentialRepo.findByIdWithRelations(credentialId);
    
    if (!credential || credential.student.id !== studentId) {
      return null;
    }

    return credential;
  }

  /**
   * Request government accreditation for a credential
   */
  async requestAccreditation(
    studentId: string,
    credentialId: string
  ): Promise<AttestationRequest> {
    // Verify student owns the credential
    const credential = await this.credentialRepo.findByIdWithRelations(credentialId);
    if (!credential || credential.student.id !== studentId) {
      throw new Error(ERROR_MESSAGES.CREDENTIAL_NOT_FOUND);
    }

    // Check if credential is active
    if (credential.status !== 'ACTIVE') {
      throw new Error(ERROR_MESSAGES.CREDENTIAL_REVOKED);
    }

    // Check if accreditation request already exists
    const existingAttestations = await this.attestationRepo.findByCredential(credentialId);
    const pendingAccreditation = existingAttestations.find(
      att => att.attestationType === 'GOVERNMENT_ACCREDITED' && att.status === 'PENDING'
    );

    if (pendingAccreditation) {
      throw new Error('Accreditation request already pending');
    }

    // Create attestation request (this will be processed by government service)
    const attestation = await this.attestationRepo.create({
      solanaAddress: '', // Will be filled when government processes the request
      transactionHash: '', // Will be filled when government processes the request
      attestationType: 'GOVERNMENT_ACCREDITED',
      credentialId,
      studentId,
      // governmentId will be assigned when government picks up the request
    });

    return {
      id: attestation.id,
      credentialId: attestation.credentialId,
      studentId: attestation.studentId,
      status: attestation.status,
      createdAt: attestation.createdAt,
      credential: {
        id: credential.id,
        title: credential.title,
        degreeType: credential.degreeType,
        graduationDate: credential.graduationDate,
        university: {
          name: credential.university.name,
          code: credential.university.code,
        },
      },
      student: {
        firstName: credential.student.firstName,
        lastName: credential.student.lastName,
        email: credential.student.email,
      },
    };
  }

  /**
   * Get student's attestation requests
   */
  async getAttestationRequests(studentId: string): Promise<AttestationRequest[]> {
    const attestations = await this.attestationRepo.findByStudentWithRelations(studentId);
    
    return attestations
      .filter(att => att.attestationType === 'GOVERNMENT_ACCREDITED')
      .map(att => ({
        id: att.id,
        credentialId: att.credentialId,
        studentId: att.studentId,
        status: att.status,
        createdAt: att.createdAt,
        credential: {
          id: att.credential.id,
          title: att.credential.title,
          degreeType: att.credential.degreeType,
          graduationDate: new Date(), // This should come from the credential relation
          university: {
            name: 'University Name', // This should come from the credential relation
            code: 'UNIV', // This should come from the credential relation
          },
        },
        student: {
          firstName: att.student.firstName,
          lastName: att.student.lastName,
          email: 'student@email.com', // This should come from the student relation
        },
      }));
  }

  /**
   * Update student information
   */
  async updateStudent(
    id: string, 
    updates: Partial<StudentData>
  ): Promise<Student> {
    const student = await this.studentRepo.findById(id);
    if (!student) {
      throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
    }

    // Check email uniqueness if updating email
    if (updates.email && updates.email !== student.email) {
      const existingByEmail = await this.studentRepo.findByEmail(updates.email);
      if (existingByEmail) {
        throw new Error('Email already registered');
      }
    }

    return this.studentRepo.update(id, updates);
  }

  /**
   * Deactivate student account
   */
  async deactivateStudent(id: string): Promise<void> {
    const student = await this.studentRepo.findById(id);
    if (!student) {
      throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
    }

    await this.studentRepo.update(id, { isActive: false });
  }
}