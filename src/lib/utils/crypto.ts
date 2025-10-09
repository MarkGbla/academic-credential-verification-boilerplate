import * as crypto from 'crypto';
import * as CryptoJS from 'crypto-js';

/**
 * Hash NIN with salt for privacy protection
 */
export function hashNIN(nin: string): string {
  const salt = process.env.NIN_SALT;
  if (!salt) {
    throw new Error('NIN_SALT environment variable is required');
  }
  
  return CryptoJS.SHA256(nin + salt).toString(CryptoJS.enc.Hex);
}

/**
 * Verify NIN hash
 */
export function verifyNINHash(nin: string, hash: string): boolean {
  return hashNIN(nin) === hash;
}

/**
 * Generate a secure random string
 */
export function generateSecureRandom(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Create a SHA256 hash of data
 */
export function sha256Hash(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Generate deterministic seed from NIN for Solana address generation
 */
export function generateSeedFromNIN(nin: string): Buffer {
  const salt = process.env.NIN_SALT;
  if (!salt) {
    throw new Error('NIN_SALT environment variable is required');
  }
  
  return crypto.createHash('sha256').update(nin + salt).digest();
}