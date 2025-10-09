import { Keypair, PublicKey } from '@solana/web3.js';
import { generateSeedFromNIN } from '../utils/crypto';

/**
 * Generate deterministic Solana address from NIN
 * This creates a consistent address for each student based on their NIN
 */
export function generateAddressFromNIN(nin: string): string {
  const seed = generateSeedFromNIN(nin);
  
  // Use first 32 bytes as keypair seed
  const keypair = Keypair.fromSeed(seed.slice(0, 32));
  
  return keypair.publicKey.toBase58();
}

/**
 * Generate keypair from NIN (for signing if needed)
 * WARNING: This should only be used server-side for student operations
 */
export function generateKeypairFromNIN(nin: string): Keypair {
  const seed = generateSeedFromNIN(nin);
  return Keypair.fromSeed(seed.slice(0, 32));
}

/**
 * Verify that a Solana address matches a given NIN
 */
export function verifyAddressForNIN(nin: string, address: string): boolean {
  const expectedAddress = generateAddressFromNIN(nin);
  return expectedAddress === address;
}

/**
 * Generate Program Derived Address (PDA) for attestations
 * This creates deterministic addresses for storing attestation data
 */
export async function generateAttestationPDA(
  credentialId: string,
  programId: PublicKey
): Promise<[PublicKey, number]> {
  const seeds = [
    Buffer.from('attestation'),
    Buffer.from(credentialId)
  ];
  
  return PublicKey.findProgramAddress(seeds, programId);
}

/**
 * Generate PDA for student credentials storage
 */
export async function generateStudentCredentialPDA(
  studentAddress: string,
  credentialId: string,
  programId: PublicKey
): Promise<[PublicKey, number]> {
  const seeds = [
    Buffer.from('student_credential'),
    new PublicKey(studentAddress).toBuffer(),
    Buffer.from(credentialId)
  ];
  
  return PublicKey.findProgramAddress(seeds, programId);
}