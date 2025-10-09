export enum UserRole {
  UNIVERSITY = 'UNIVERSITY',
  STUDENT = 'STUDENT',
  GOVERNMENT = 'GOVERNMENT',
  EMPLOYER = 'EMPLOYER'
}

export interface BaseUser {
  id: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UniversityUser extends BaseUser {
  role: UserRole.UNIVERSITY;
  name: string;
  code: string;
  country: string;
  wallet?: string;
  publicKey: string;
}

export interface StudentUser extends BaseUser {
  role: UserRole.STUDENT;
  ninHash: string;
  firstName: string;
  lastName: string;
  wallet?: string;
  solanaAddress: string;
}

export interface GovernmentUser extends BaseUser {
  role: UserRole.GOVERNMENT;
  name: string;
  type: 'MINISTRY_OF_EDUCATION' | 'MINISTRY_OF_FOREIGN_AFFAIRS' | 'ACCREDITATION_BODY';
  country: string;
  wallet?: string;
  publicKey: string;
}

export type User = UniversityUser | StudentUser | GovernmentUser;