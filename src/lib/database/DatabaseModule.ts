import { PrismaClient } from '@prisma/client';
import { PrismaCredentialRepository } from './repositories/PrismaCredentialRepository';
import { PrismaStudentRepository } from './repositories/PrismaStudentRepository';
import { PrismaUniversityRepository } from './repositories/PrismaUniversityRepository';
import { PrismaGovernmentRepository } from './repositories/PrismaGovernmentRepository';
import { PrismaAttestationRepository } from './repositories/PrismaAttestationRepository';

class DatabaseModule {
  private static instance: DatabaseModule;
  private prisma: PrismaClient;
  
  // Repositories
  public credentialRepository: PrismaCredentialRepository;
  public studentRepository: PrismaStudentRepository;
  public universityRepository: PrismaUniversityRepository;
  public governmentRepository: PrismaGovernmentRepository;
  public attestationRepository: PrismaAttestationRepository;

  private constructor() {
    this.prisma = new PrismaClient({
      log: ['query', 'info', 'warn', 'error'],
    });
    
    this.initializeRepositories();
  }

  public static getInstance(): DatabaseModule {
    if (!DatabaseModule.instance) {
      DatabaseModule.instance = new DatabaseModule();
    }
    return DatabaseModule.instance;
  }

  private initializeRepositories(): void {
    this.credentialRepository = new PrismaCredentialRepository(this.prisma);
    this.studentRepository = new PrismaStudentRepository(this.prisma);
    this.universityRepository = new PrismaUniversityRepository(this.prisma);
    this.governmentRepository = new PrismaGovernmentRepository(this.prisma);
    this.attestationRepository = new PrismaAttestationRepository(this.prisma);
  }

  public async connect(): Promise<void> {
    try {
      await this.prisma.$connect();
      console.log('Database connected successfully');
    } catch (error) {
      console.error('Database connection error:', error);
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    try {
      await this.prisma.$disconnect();
      console.log('Database disconnected successfully');
    } catch (error) {
      console.error('Error disconnecting from database:', error);
      throw error;
    }
  }

  public getPrismaClient(): PrismaClient {
    return this.prisma;
  }
}

export const database = DatabaseModule.getInstance();
