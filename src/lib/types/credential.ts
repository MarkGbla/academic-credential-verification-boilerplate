export enum DegreeType {
  BACHELOR = 'BACHELOR',
  MASTER = 'MASTER',
  DOCTORATE = 'DOCTORATE',
  DIPLOMA = 'DIPLOMA',
  CERTIFICATE = 'CERTIFICATE'
}

export enum CredentialStatus {
  ACTIVE = 'ACTIVE',
  REVOKED = 'REVOKED',
  EXPIRED = 'EXPIRED'
}

export interface CredentialData {
  title: string;
  degreeType: DegreeType;
  major?: string;
  graduationDate: Date;
  gpa?: number;
  expiryDate?: Date;
  metadata?: Record<string, any>;
}

export interface CreateCredentialData extends CredentialData {
  universityId: string;
  studentId: string;
}

export interface UpdateCredentialData {
  title?: string;
  status?: CredentialStatus;
  expiryDate?: Date;
  metadata?: Record<string, any>;
}

export interface CredentialWithRelations {
  id: string;
  title: string;
  degreeType: DegreeType;
  major?: string;
  graduationDate: Date;
  gpa?: number;
  issuanceDate: Date;
  expiryDate?: Date;
  status: CredentialStatus;
  metadata: Record<string, any>;
  university: {
    id: string;
    name: string;
    code: string;
    country: string;
  };
  student: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  attestations: Array<{
    id: string;
    solanaAddress: string;
    transactionHash: string;
    attestationType: string;
    status: string;
  }>;
}