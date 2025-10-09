import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

let authorityKeypair: Keypair | null = null;

export function getAuthorityKeypair(): Keypair {
  if (!authorityKeypair) {
    const privateKey = process.env.SOLANA_PRIVATE_KEY;
    
    if (!privateKey) {
      throw new Error('SOLANA_PRIVATE_KEY environment variable is required');
    }
    
    try {
      const secretKey = bs58.decode(privateKey);
      authorityKeypair = Keypair.fromSecretKey(secretKey);
    } catch (error) {
      throw new Error('Invalid SOLANA_PRIVATE_KEY format. Expected base58 encoded string.');
    }
  }
  
  return authorityKeypair;
}

export function getAuthorityPublicKey(): string {
  return getAuthorityKeypair().publicKey.toBase58();
}