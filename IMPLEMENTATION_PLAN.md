# Academic Credential Verification Platform - Implementation Plan

## Architecture Overview

This platform implements a blockchain-based academic credential verification system using:
- **Repository Pattern**: Clean separation of data access logic
- **Service Pattern**: Business logic encapsulation
- **Privy Authentication**: User management and wallet connectivity
- **Solana Attestation Service (SAS)**: Immutable credential attestations
- **NIN-based Identity**: Privacy-preserving student identification

## System Actors

### Primary Entities
1. **Universities**: Issue digital credentials and academic certificates
2. **Students**: View certificates, request government accreditation
3. **Government (Ministry)**: Create attestations/accreditations for student certificates
4. **Employers**: Verify student credentials (read-only access)

### Technical Components
- **Single Keypair**: Acts as both payer and authority for all Solana operations
- **NIN-based Addressing**: Student identity derived from National Identification Number
- **Hybrid Storage**: Off-chain metadata (Prisma/PostgreSQL) + On-chain attestations (Solana)

## Project Structure

```
src/
├── lib/
│   ├── database/
│   │   ├── repositories/           # Data access layer
│   │   │   ├── interfaces/
│   │   │   │   ├── IUniversityRepository.ts
│   │   │   │   ├── IStudentRepository.ts
│   │   │   │   ├── ICredentialRepository.ts
│   │   │   │   ├── IGovernmentRepository.ts
│   │   │   │   └── IAttestationRepository.ts
│   │   │   ├── UniversityRepository.ts
│   │   │   ├── StudentRepository.ts
│   │   │   ├── CredentialRepository.ts
│   │   │   ├── GovernmentRepository.ts
│   │   │   └── AttestationRepository.ts
│   │   └── prisma.ts               # Database connection
│   ├── services/                   # Business logic layer
│   │   ├── UniversityService.ts
│   │   ├── StudentService.ts
│   │   ├── GovernmentService.ts
│   │   ├── AttestationService.ts
│   │   ├── AuthService.ts
│   │   └── VerificationService.ts
│   ├── solana/
│   │   ├── config.ts               # Solana configuration
│   │   ├── keypair.ts              # Keypair management
│   │   ├── attestation.ts          # SAS integration
│   │   └── address-generation.ts   # NIN-based addressing
│   ├── auth/
│   │   ├── privy-config.ts         # Privy configuration
│   │   ├── middleware.ts           # Auth middleware
│   │   └── roles.ts                # Role-based access control
│   ├── utils/
│   │   ├── crypto.ts               # NIN hashing utilities
│   │   ├── validation.ts           # Input validation
│   │   └── constants.ts            # Application constants
│   └── types/
│       ├── credential.ts           # Credential type definitions
│       ├── attestation.ts          # Attestation type definitions
│       └── user.ts                 # User type definitions
├── app/
│   ├── api/                        # API routes
│   │   ├── auth/
│   │   ├── universities/
│   │   ├── students/
│   │   ├── government/
│   │   ├── credentials/
│   │   ├── attestations/
│   │   └── verification/
│   ├── dashboard/                  # Protected dashboards
│   │   ├── university/
│   │   ├── student/
│   │   ├── government/
│   │   └── components/
│   ├── verify/                     # Public verification
│   └── auth/                       # Authentication pages
├── components/                     # Shared UI components
│   ├── ui/
│   ├── auth/
│   ├── credential/
│   └── verification/
└── prisma/
    ├── schema.prisma               # Database schema
    └── migrations/
```

## Implementation Phases

### Phase 1: Foundation Setup

#### 1.1 Dependencies & Configuration
```json
{
  "dependencies": {
    "@privy-io/react-auth": "^1.82.0",
    "@privy-io/server-auth": "^1.82.0",
    "@solana/web3.js": "^1.95.0",
    "@solana/kit": "^1.0.0",
    "@prisma/client": "^5.0.0",
    "prisma": "^5.0.0",
    "@noble/ed25519": "^2.0.0",
    "jsonwebtoken": "^9.0.0",
    "bcryptjs": "^2.4.3",
    "uuid": "^9.0.0",
    "zod": "^3.22.0"
  }
}
```

#### 1.2 Environment Variables
```env
# Privy Configuration
NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id
PRIVY_APP_SECRET=your_privy_app_secret

# Solana Configuration
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_PRIVATE_KEY=your_base58_private_key

# Database
DATABASE_URL=postgresql://username:password@localhost:5432/acv_db

# Application
JWT_SECRET=your_jwt_secret
NIN_SALT=your_nin_hashing_salt
```

### Phase 2: Database Layer (Repository Pattern)

#### 2.1 Prisma Schema
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model University {
  id          String   @id @default(uuid())
  name        String
  code        String   @unique
  country     String
  email       String   @unique
  wallet      String?  // Solana wallet address
  publicKey   String   // Verification public key
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  credentials Credential[]
  
  @@map("universities")
}

model Student {
  id           String   @id @default(uuid())
  ninHash      String   @unique // Hashed NIN for privacy
  firstName    String
  lastName     String
  email        String   @unique
  wallet       String?  // Solana wallet address
  solanaAddress String @unique // Derived from NIN
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  
  credentials  Credential[]
  attestations Attestation[]
  
  @@map("students")
}

model Government {
  id        String   @id @default(uuid())
  name      String   // e.g., "Ministry of Education"
  type      GovernmentType
  country   String
  wallet    String?  // Solana wallet address
  publicKey String   // Verification public key
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  attestations Attestation[]
  
  @@map("government_entities")
}

model Credential {
  id              String     @id @default(uuid())
  title           String     // e.g., "Bachelor of Computer Science"
  degreeType      DegreeType
  major           String?
  graduationDate  DateTime
  gpa             Float?
  issuanceDate    DateTime   @default(now())
  expiryDate      DateTime?
  status          CredentialStatus @default(ACTIVE)
  metadata        Json       // Additional credential data
  
  universityId    String
  university      University @relation(fields: [universityId], references: [id])
  studentId       String
  student         Student    @relation(fields: [studentId], references: [id])
  
  attestations    Attestation[]
  
  @@map("credentials")
}

model Attestation {
  id                String      @id @default(uuid())
  solanaAddress     String      @unique // On-chain attestation address
  transactionHash   String      @unique // Solana transaction hash
  attestationType   AttestationType
  status            AttestationStatus @default(PENDING)
  createdAt         DateTime    @default(now())
  updatedAt         DateTime    @updatedAt
  
  credentialId      String
  credential        Credential  @relation(fields: [credentialId], references: [id])
  studentId         String
  student           Student     @relation(fields: [studentId], references: [id])
  governmentId      String?
  government        Government? @relation(fields: [governmentId], references: [id])
  
  @@map("attestations")
}

enum GovernmentType {
  MINISTRY_OF_EDUCATION
  MINISTRY_OF_FOREIGN_AFFAIRS
  ACCREDITATION_BODY
}

enum DegreeType {
  BACHELOR
  MASTER
  DOCTORATE
  DIPLOMA
  CERTIFICATE
}

enum CredentialStatus {
  ACTIVE
  REVOKED
  EXPIRED
}

enum AttestationType {
  UNIVERSITY_ISSUED
  GOVERNMENT_ACCREDITED
}

enum AttestationStatus {
  PENDING
  APPROVED
  REJECTED
}
```

#### 2.2 Repository Interfaces

```typescript
// src/lib/database/repositories/interfaces/IStudentRepository.ts
export interface IStudentRepository {
  create(data: CreateStudentData): Promise<Student>;
  findById(id: string): Promise<Student | null>;
  findByNinHash(ninHash: string): Promise<Student | null>;
  findBySolanaAddress(address: string): Promise<Student | null>;
  update(id: string, data: UpdateStudentData): Promise<Student>;
  delete(id: string): Promise<void>;
}

// src/lib/database/repositories/interfaces/ICredentialRepository.ts
export interface ICredentialRepository {
  create(data: CreateCredentialData): Promise<Credential>;
  findById(id: string): Promise<Credential | null>;
  findByStudent(studentId: string): Promise<Credential[]>;
  findByUniversity(universityId: string): Promise<Credential[]>;
  update(id: string, data: UpdateCredentialData): Promise<Credential>;
  updateStatus(id: string, status: CredentialStatus): Promise<Credential>;
}
```

### Phase 3: Service Layer (Business Logic)

#### 3.1 Core Services

```typescript
// src/lib/services/StudentService.ts
export class StudentService {
  constructor(
    private studentRepo: IStudentRepository,
    private credentialRepo: ICredentialRepository,
    private attestationService: AttestationService
  ) {}

  async registerStudent(nin: string, userData: StudentData): Promise<Student> {
    // Hash NIN for privacy
    const ninHash = await hashNIN(nin);
    
    // Generate deterministic Solana address from NIN
    const solanaAddress = generateAddressFromNIN(nin);
    
    return this.studentRepo.create({
      ...userData,
      ninHash,
      solanaAddress
    });
  }

  async getCredentials(studentId: string): Promise<Credential[]> {
    return this.credentialRepo.findByStudent(studentId);
  }

  async requestAccreditation(
    studentId: string, 
    credentialId: string
  ): Promise<AttestationRequest> {
    // Business logic for government accreditation request
    return this.attestationService.createAccreditationRequest(
      studentId, 
      credentialId
    );
  }
}

// src/lib/services/UniversityService.ts
export class UniversityService {
  constructor(
    private universityRepo: IUniversityRepository,
    private credentialRepo: ICredentialRepository,
    private attestationService: AttestationService
  ) {}

  async issueCredential(
    universityId: string,
    studentId: string,
    credentialData: CredentialData
  ): Promise<Credential> {
    // Create credential record
    const credential = await this.credentialRepo.create({
      ...credentialData,
      universityId,
      studentId
    });

    // Create on-chain attestation
    await this.attestationService.createUniversityAttestation(credential);

    return credential;
  }
}

// src/lib/services/GovernmentService.ts
export class GovernmentService {
  constructor(
    private governmentRepo: IGovernmentRepository,
    private attestationRepo: IAttestationRepository,
    private attestationService: AttestationService
  ) {}

  async accreditateCredential(
    governmentId: string,
    credentialId: string
  ): Promise<Attestation> {
    // Create government attestation
    return this.attestationService.createGovernmentAttestation(
      governmentId,
      credentialId
    );
  }

  async getPendingRequests(governmentId: string): Promise<AttestationRequest[]> {
    // Get pending accreditation requests
    return this.attestationRepo.findPendingByGovernment(governmentId);
  }
}
```

### Phase 4: Solana Integration

#### 4.1 Attestation Service

```typescript
// src/lib/services/AttestationService.ts
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { SolanaAttestationService } from '@solana/kit';

export class AttestationService {
  private connection: Connection;
  private authority: Keypair;
  private sasClient: SolanaAttestationService;

  constructor() {
    this.connection = new Connection(process.env.SOLANA_RPC_URL!);
    this.authority = Keypair.fromSecretKey(
      bs58.decode(process.env.SOLANA_PRIVATE_KEY!)
    );
    this.sasClient = new SolanaAttestationService(this.connection);
  }

  async createUniversityAttestation(credential: Credential): Promise<string> {
    const studentAddress = new PublicKey(credential.student.solanaAddress);
    
    // Create attestation data
    const attestationData = {
      credentialId: credential.id,
      universityId: credential.universityId,
      degreeType: credential.degreeType,
      graduationDate: credential.graduationDate.toISOString(),
      metadata: credential.metadata
    };

    // Create on-chain attestation
    const transaction = await this.sasClient.createAttestation({
      authority: this.authority.publicKey,
      subject: studentAddress,
      data: attestationData,
      schema: ACADEMIC_CREDENTIAL_SCHEMA
    });

    const signature = await this.connection.sendTransaction(
      transaction,
      [this.authority]
    );

    return signature;
  }

  async createGovernmentAttestation(
    governmentId: string,
    credentialId: string
  ): Promise<string> {
    // Similar to university attestation but for government accreditation
    // Links to the original university attestation
  }
}

// src/lib/solana/address-generation.ts
export function generateAddressFromNIN(nin: string): string {
  const seed = crypto
    .createHash('sha256')
    .update(nin + process.env.NIN_SALT)
    .digest();
  
  const keypair = Keypair.fromSeed(seed.slice(0, 32));
  return keypair.publicKey.toBase58();
}
```

### Phase 5: API Development

#### 5.1 API Routes Structure

```typescript
// app/api/students/register/route.ts
export async function POST(request: Request) {
  const studentService = new StudentService(
    new StudentRepository(),
    new CredentialRepository(),
    new AttestationService()
  );

  const { nin, ...userData } = await request.json();
  
  try {
    const student = await studentService.registerStudent(nin, userData);
    return NextResponse.json({ student });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

// app/api/credentials/issue/route.ts
export async function POST(request: Request) {
  const universityService = new UniversityService(
    new UniversityRepository(),
    new CredentialRepository(),
    new AttestationService()
  );

  const { universityId, studentId, credentialData } = await request.json();
  
  try {
    const credential = await universityService.issueCredential(
      universityId,
      studentId,
      credentialData
    );
    return NextResponse.json({ credential });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
```

### Phase 6: Authentication & Authorization

#### 6.1 Privy Integration

```typescript
// src/lib/auth/privy-config.ts
export const privyConfig = {
  appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  config: {
    loginMethods: ['email', 'wallet'],
    appearance: {
      theme: 'light',
      accentColor: '#676FFF',
    },
    embeddedWallets: {
      createOnLogin: 'users-without-wallets',
    },
  },
};

// src/lib/auth/middleware.ts
export async function withAuth(
  request: NextRequest,
  requiredRole?: UserRole
) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const user = await verifyAuthToken(token);
    
    if (requiredRole && user.role !== requiredRole) {
      return new NextResponse('Forbidden', { status: 403 });
    }

    return { user };
  } catch (error) {
    return new NextResponse('Invalid token', { status: 401 });
  }
}
```

## Implementation Timeline

### Week 1: Foundation
- [ ] Setup project dependencies
- [ ] Configure Solana and Privy
- [ ] Create database schema
- [ ] Implement repository interfaces

### Week 2: Core Services
- [ ] Implement service layer
- [ ] Setup Solana attestation integration
- [ ] Create NIN-based addressing
- [ ] Implement authentication

### Week 3: API Development
- [ ] Create API endpoints
- [ ] Implement role-based access control
- [ ] Setup error handling and validation
- [ ] Add comprehensive testing

### Week 4: Frontend & Integration
- [ ] Build user dashboards
- [ ] Implement wallet connectivity
- [ ] Create verification interface
- [ ] End-to-end testing

## Key Technical Decisions

### Repository Pattern Benefits
- **Separation of Concerns**: Data access logic isolated from business logic
- **Testability**: Easy to mock repositories for unit testing
- **Flexibility**: Can easily switch database providers
- **Maintainability**: Clear interfaces make code easier to understand

### Service Pattern Benefits
- **Business Logic Encapsulation**: All business rules in dedicated services
- **Reusability**: Services can be used across multiple API endpoints
- **Transaction Management**: Services handle complex multi-step operations
- **Validation**: Centralized input validation and business rule enforcement

### NIN-Based Identity
- **Privacy**: NIN is hashed and never stored in plaintext
- **Deterministic**: Same NIN always generates same Solana address
- **Unique**: Each student has a unique blockchain identity
- **Portable**: Students can access credentials from any device

## Security Considerations

1. **NIN Protection**: Hash with strong salt, never log or expose
2. **Keypair Security**: Store private key securely, consider HSM for production
3. **Role-Based Access**: Strict permissions for each user type
4. **Input Validation**: Validate all inputs using Zod schemas
5. **Rate Limiting**: Implement rate limiting on all API endpoints
6. **Audit Trail**: Log all credential operations for compliance

## Testing Strategy

1. **Unit Tests**: Test repositories and services in isolation
2. **Integration Tests**: Test API endpoints with database
3. **Blockchain Tests**: Test Solana attestation creation and verification
4. **E2E Tests**: Test complete user workflows
5. **Security Tests**: Test authorization and input validation

This implementation plan provides a solid foundation for building a scalable, secure academic credential verification platform using modern architecture patterns and blockchain technology.