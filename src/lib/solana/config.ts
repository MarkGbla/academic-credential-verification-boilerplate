import { Connection, Commitment } from '@solana/web3.js';
import { SOLANA_CONFIG } from '../utils/constants';

let connection: Connection | null = null;

export function getSolanaConnection(): Connection {
  if (!connection) {
    connection = new Connection(
      SOLANA_CONFIG.rpcUrl,
      SOLANA_CONFIG.commitment as Commitment
    );
  }
  return connection;
}

export const solanaConfig = {
  connection: getSolanaConnection(),
  network: SOLANA_CONFIG.network,
  rpcUrl: SOLANA_CONFIG.rpcUrl,
  commitment: SOLANA_CONFIG.commitment,
} as const;