# Academic Credential Verification Platform 🎓⛓️

A **production-ready boilerplate** for building blockchain-based academic credential verification systems using Repository/Service pattern architecture.

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![Solana](https://img.shields.io/badge/Solana-9945FF?style=for-the-badge&logo=solana&logoColor=white)](https://solana.com/)
[![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-336791?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)

## 🚀 Quick Start

```bash
# Clone the repository
git clone <your-repo-url>
cd acv

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your configuration

# Setup database
npm run db:generate
npm run db:push

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## 🎯 What's This?

This boilerplate provides a **complete foundation** for academic credential verification platforms where:

- 🎓 **Universities** issue tamper-proof digital credentials
- 👨‍🎓 **Students** own credentials in Solana wallets with privacy protection
- 🏛️ **Government** entities accredit credentials through blockchain attestations
- 🏢 **Employers** instantly verify credential authenticity

## ✨ Key Features

### 🏗️ **Clean Architecture**
- **Repository Pattern**: Separation of data access and business logic
- **Service Layer**: Encapsulated business operations for each entity
- **Type-Safe**: Full TypeScript coverage with Prisma-generated types
- **Modular**: Easy to extend and customize

### ⛓️ **Blockchain Integration**
- **Solana Attestation Service**: Native credential storage on Solana
- **NIN-Based Identity**: Privacy-preserving student identification
- **Deterministic Addressing**: Consistent Solana addresses from National ID
- **Mock SAS Ready**: Easy integration with production SAS SDK

### 🔐 **Authentication & Security**
- **Privy Integration**: Multi-wallet Web3 authentication
- **Role-Based Access**: University, Student, Government, Employer permissions
- **JWT Security**: Secure token-based authentication
- **Privacy Protection**: Hashed NIN storage, never plaintext

### 🗄️ **Database Architecture**
- **PostgreSQL + Prisma**: Type-safe database operations
- **Complete Schema**: Universities, Students, Government, Credentials, Attestations
- **Relationship Management**: Proper foreign keys and data integrity
- **Migration Ready**: Database evolution support

## 🛠️ Tech Stack

| Category | Technology | Purpose |
|----------|------------|---------|
| **Framework** | Next.js 15 + TypeScript | Full-stack React with App Router |
| **Database** | PostgreSQL + Prisma | Type-safe database with ORM |
| **Blockchain** | Solana + SAS | Fast, low-cost credential attestations |
| **Authentication** | Privy | Web3 wallet authentication |
| **Styling** | TailwindCSS | Utility-first CSS framework |
| **Validation** | Zod | Runtime type validation |
| **Crypto** | @noble/ed25519 | Cryptographic operations |

## 📁 Project Structure

```
src/lib/
├── database/
│   ├── repositories/           # Data access layer
│   │   ├── interfaces/         # Repository contracts
│   │   ├── StudentRepository.ts
│   │   ├── UniversityRepository.ts
│   │   ├── GovernmentRepository.ts
│   │   ├── CredentialRepository.ts
│   │   └── AttestationRepository.ts
│   └── prisma.ts              # Database connection
├── services/                  # Business logic layer
│   ├── StudentService.ts      # Student operations
│   ├── UniversityService.ts   # University operations
│   ├── GovernmentService.ts   # Government operations
│   ├── AttestationService.ts  # Blockchain operations
│   └── VerificationService.ts # Public verification
├── solana/                    # Blockchain integration
│   ├── config.ts             # Solana configuration
│   ├── keypair.ts            # Key management
│   ├── attestation.ts        # SAS integration
│   └── address-generation.ts # NIN-based addressing
├── auth/                     # Authentication system
│   ├── privy-config.ts       # Privy setup
│   ├── middleware.ts         # Auth middleware
│   └── roles.ts              # RBAC system
├── utils/                    # Utilities
│   ├── crypto.ts             # Cryptographic functions
│   ├── validation.ts         # Zod schemas
│   └── constants.ts          # App constants
└── types/                    # TypeScript definitions
    ├── user.ts
    ├── credential.ts
    └── attestation.ts
```

## 🔧 Available Scripts

```bash
# Development
npm run dev              # Start development server
npm run build            # Build for production
npm run start            # Start production server

# Database
npm run db:generate      # Generate Prisma client
npm run db:push          # Push schema to database
npm run db:migrate       # Create and run migrations
npm run db:studio        # Open Prisma Studio

# Code Quality
npm run lint             # Run ESLint
npm run type-check       # Run TypeScript compiler
```

## ⚙️ Environment Configuration

Create a `.env` file from `.env.example`:

```bash
# Privy Authentication
NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id
PRIVY_APP_SECRET=your_privy_app_secret

# Solana Configuration
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_PRIVATE_KEY=your_base58_private_key

# Database
DATABASE_URL=postgresql://username:password@localhost:5432/acv_db

# Security
JWT_SECRET=your_jwt_secret_key
NIN_SALT=your_nin_hashing_salt
```

## 👥 Entity System

### 🎓 Universities
- Register and manage institutional profiles
- Issue digital credentials to students
- Create blockchain attestations for credentials
- Track student records and statistics

### 👨‍🎓 Students
- Register with NIN-based privacy protection
- View and manage their credentials
- Request government accreditation
- Own credentials in Solana wallets

### 🏛️ Government Entities
- Review pending accreditation requests
- Approve/reject credential attestations
- Create government attestation links
- Track approval workflows and statistics

### 🏢 Employers
- Verify credential authenticity (read-only)
- Access public verification interface
- Batch verify multiple credentials
- Generate verification reports

## 🔐 Security Features

### Privacy Protection
- **NIN Hashing**: National IDs hashed with salt, never stored plaintext
- **Deterministic Addressing**: Consistent Solana addresses from NIN
- **Role-Based Access**: Granular permissions for each user type

### Blockchain Security
- **Single Authority**: Unified keypair for all blockchain operations
- **Transaction Verification**: Confirmation and error handling
- **Address Validation**: Proper Solana address verification

## 🎨 Customization Guide

### Adding New Entity Types
1. Update Prisma schema in `prisma/schema.prisma`
2. Create repository interface and implementation
3. Add service class with business logic
4. Update authentication permissions
5. Add validation schemas

### Integrating Production SAS
1. Replace mock calls in `SolanaAttestationService`
2. Install actual SAS SDK
3. Update attestation data structures
4. Add proper error handling

### Database Modifications
1. Modify Prisma schema
2. Run `npm run db:migrate`
3. Update repository interfaces
4. Regenerate Prisma client

## 📚 Documentation

- **[PRD_BOILERPLATE.md](./PRD_BOILERPLATE.md)** - Complete product requirements and architecture
- **[IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)** - Detailed technical implementation guide
- **[.env.example](./.env.example)** - Environment configuration template

## 🚀 Deployment

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL database
- Solana wallet with devnet SOL
- Privy account and app configuration

### Production Checklist
- [ ] Secure environment variables
- [ ] Database connection pooling
- [ ] Rate limiting implementation
- [ ] Error monitoring setup
- [ ] SSL certificate configuration
- [ ] Backup and recovery plan

## 🔮 What's Next (Phase 3+)

This boilerplate includes the core architecture. Next phases could add:

- **API Endpoints**: REST API using Repository/Service pattern
- **Frontend Dashboards**: Role-specific user interfaces
- **Real-time Features**: Notifications and live updates
- **Advanced Analytics**: Reporting and insights
- **Mobile Support**: React Native or PWA
- **Testing Suite**: Unit and integration tests

## 🤝 Contributing

1. **Follow Patterns**: Maintain Repository/Service architecture
2. **Type Safety**: Add proper TypeScript types
3. **Documentation**: Update README and PRD as needed
4. **Testing**: Add tests for new features
5. **Security**: Consider security implications

## 📄 License

MIT License - see [LICENSE](./LICENSE) file for details.

## 🆘 Support

This is a boilerplate project. For issues:

1. Check the [PRD_BOILERPLATE.md](./PRD_BOILERPLATE.md) for architecture details
2. Review [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) for technical guidance
3. Ensure all environment variables are properly configured
4. Verify database connection and Solana network access

## 📖 Resources & References

### 🔗 **Key Documentation**
- **[Solana Attestation Service](https://attest.solana.com/)** - Official SAS documentation and SDK
- **[Privy Documentation](https://docs.privy.io/)** - Web3 authentication integration guide
- **[Solana Web3.js](https://solana-labs.github.io/solana-web3.js/)** - Solana blockchain interaction library
- **[Prisma Documentation](https://www.prisma.io/docs)** - Database ORM and migration guide
- **[Next.js App Router](https://nextjs.org/docs/app)** - Modern React framework documentation

### 🛠️ **Implementation Examples**
- **[SAS Implementation Example](https://github.com/saidubundukamara/solana-attestation-service-example)** - Real-world SAS integration patterns
- **[Privy Authentication Examples](https://docs.privy.io/guide/react/authentication)** - Multi-wallet auth implementation
- **[Repository Pattern in TypeScript](https://blog.logrocket.com/implementing-repository-pattern-typescript/)** - Clean architecture patterns

### 🎓 **Academic Credential Standards**
- **[W3C Verifiable Credentials](https://www.w3.org/TR/vc-data-model/)** - Standard for digital credentials
- **[Blockcerts](https://www.blockcerts.org/)** - Open standard for blockchain certificates
- **[MIT Digital Diplomas](https://news.mit.edu/2017/mit-first-university-issue-blockchain-certificates-1017)** - Real-world implementation case study

### ⛓️ **Blockchain Development**
- **[Solana Program Library](https://spl.solana.com/)** - Standard Solana programs and utilities
- **[Solana Cookbook](https://solanacookbook.com/)** - Practical Solana development guide


---

**Ready to build the future of academic credential verification!** 🎓⛓️