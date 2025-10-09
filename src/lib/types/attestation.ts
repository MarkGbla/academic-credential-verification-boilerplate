export enum AttestationType {
  UNIVERSITY_ISSUED = 'UNIVERSITY_ISSUED',
  GOVERNMENT_ACCREDITED = 'GOVERNMENT_ACCREDITED'
}

export enum AttestationStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED'
}

export interface AttestationData {
  credentialId: string;
  studentId: string;
  attestationType: AttestationType;
  governmentId?: string;
}

export interface CreateAttestationData extends AttestationData {
  solanaAddress: string;
  transactionHash: string;
}

export interface AttestationRequest {
  id: string;
  credentialId: string;
  studentId: string;
  status: AttestationStatus;
  createdAt: Date;
  credential: {
    id: string;
    title: string;
    degreeType: string;
    graduationDate: Date;
    university: {
      name: string;
      code: string;
    };
  };
  student: {
    firstName: string;
    lastName: string;
    email: string;
  };
}

export interface SolanaAttestationData {
  credentialId: string;
  universityId: string;
  degreeType: string;
  graduationDate: string;
  metadata: Record<string, any>;
}

export interface AttestationWithRelations {
  id: string;
  solanaAddress: string;
  transactionHash: string;
  attestationType: AttestationType;
  status: AttestationStatus;
  createdAt: Date;
  updatedAt: Date;
  credential: {
    id: string;
    title: string;
    degreeType: string;
  };
  student: {
    id: string;
    firstName: string;
    lastName: string;
  };
  government?: {
    id: string;
    name: string;
    type: string;
  };
}