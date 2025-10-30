// BlockchainService.ts
import {
  AccountInfo,
  Commitment,
  Connection,
  Keypair,
  Logs,
  PublicKey,
  SendOptions,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import bs58 from 'bs58';
import { EventEmitter } from 'events';
import { sleep } from '../utils/async';

export enum BlockchainEvent {
  TRANSACTION_CREATED = 'transaction_created',
  TRANSACTION_SENT = 'transaction_sent',
  TRANSACTION_CONFIRMED = 'transaction_confirmed',
  TRANSACTION_FAILED = 'transaction_failed',
  ACCOUNT_CHANGED = 'account_changed',
  SAS_AUTHENTICATION_STARTED = 'sas_authentication_started',
  SAS_AUTHENTICATION_COMPLETED = 'sas_authentication_completed',
  SAS_AUTHENTICATION_FAILED = 'sas_authentication_failed',
  SAS_SESSION_EXPIRED = 'sas_session_expired',
}

interface SASConfig {
  apiKey: string;
  authEndpoint: string;
  programId?: string;
  sessionTimeout?: number;
  autoRefresh?: boolean;
  wsEndpoint?: string;
  commitment?: Commitment;
}

interface SASSession {
  token: string;
  expiresAt: number;
  refreshToken?: string;
  user: {
    id: string;
    email?: string;
    [k: string]: any;
  };
}

interface SASEvent {
  type: string;
  data: any;
  timestamp?: number;
}

export interface BlockchainConfig {
  rpcUrl: string;
  programId: string;
  walletPrivateKey: string; // base58 encoded secret key (64 bytes)
  sas?: SASConfig;
  eventListeners?: {
    [key in BlockchainEvent]?: (...args: any[]) => void;
  };
}

export interface AttestationData {
  credentialId: string;
  studentId: string;
  universityId: string;
  attestationType: 'UNIVERSITY_ISSUED' | 'GOVERNMENT_ACCREDITED';
  metadata?: Record<string, any>;
  [k: string]: any;
}

interface AttestationAccountData extends AttestationData {
  timestamp?: number;
  issuer?: string;
}

/* ----------------------------- Custom Errors ------------------------------ */

export class BlockchainError extends Error {
  constructor(message: string, public readonly code?: string, public readonly txSignature?: string) {
    super(message);
    this.name = 'BlockchainError';
  }
}

export class TransactionTimeoutError extends BlockchainError {
  constructor(message: string, txSignature?: string) {
    super(message, 'TRANSACTION_TIMEOUT', txSignature);
    this.name = 'TransactionTimeoutError';
  }
}

export class TransactionFailedError extends BlockchainError {
  constructor(message: string, public readonly logs?: string[], txSignature?: string) {
    super(message, 'TRANSACTION_FAILED', txSignature);
    this.name = 'TransactionFailedError';
  }
}

/* --------------------------- BlockchainService --------------------------- */

export class BlockchainService extends EventEmitter {
  private connection: Connection;
  private programId: PublicKey;
  private wallet: Keypair;
  private confirmationTimeout = 30_000; // ms
  private maxRetries = 5;
  private retryDelay = 1000; // ms base for exponential backoff
  private sasConfig: (SASConfig & { commitment?: Commitment }) | null = null;
  private sasSession: SASSession | null = null;
  private sasRefreshTimeout: NodeJS.Timeout | null = null;
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private accountChangeListeners: Map<string, number> = new Map();
  private logsSubscriptionId: number | null = null;

  constructor(private config: BlockchainConfig) {
    super();

    if (!config.rpcUrl) throw new Error('rpcUrl required in config');
    if (!config.programId) throw new Error('programId required in config');
    if (!config.walletPrivateKey) throw new Error('walletPrivateKey required in config');

    this.connection = new Connection(config.rpcUrl, 'confirmed');
    this.programId = new PublicKey(config.programId);

    // Decode keypair (base58). Expect 64-byte secret key; allow 32 but warn.
    try {
      const decoded = bs58.decode(config.walletPrivateKey);
      let secret: Uint8Array;
      if (decoded.length === 64) {
        secret = decoded;
      } else if (decoded.length === 32) {
        // Not ideal: prefer full 64-byte secret key. Expand into 64 bytes by padding (best to give full secret).
        const arr = new Uint8Array(64);
        arr.set(decoded, 0);
        secret = arr;
        console.warn('Using 32-byte seed expanded into 64-byte buffer — prefer supplying full 64-byte secret key.');
      } else {
        throw new Error('walletPrivateKey must be a base58 encoded 64-byte secret key (or 32-byte seed)');
      }
      this.wallet = Keypair.fromSecretKey(secret);
    } catch (err) {
      throw new Error(`Failed to parse walletPrivateKey: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (config.sas) {
      this.sasConfig = {
        ...config.sas,
        sessionTimeout: config.sas.sessionTimeout ?? 3_600_000,
        autoRefresh: config.sas.autoRefresh !== false,
        wsEndpoint: config.sas.wsEndpoint ?? config.rpcUrl.replace(/^http/, 'ws'),
        commitment: config.sas.commitment ?? 'confirmed',
      };
    }

    // Attach provided event listeners
    if (config.eventListeners) {
      Object.entries(config.eventListeners).forEach(([evt, listener]) => {
        this.on(evt as any, listener as any);
      });
    }
  }

  /* ------------------------------- SAS/Auth ------------------------------- */

  public async authenticateWithSAS(credentials?: { username: string; password: string }): Promise<SASSession> {
    if (!this.sasConfig) throw new Error('SAS not configured');

    this.emit(BlockchainEvent.SAS_AUTHENTICATION_STARTED);

    try {
      const url = this.sasConfig.authEndpoint.replace(/\/$/, '') + '/authenticate';
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.sasConfig.apiKey,
        },
        body: JSON.stringify(credentials ?? {}),
      });

      if (!res.ok) {
        const text = await res.text();
        const errJson = safeParseJson(text, {} as any);
        const msg = (errJson && (errJson.message || errJson.error)) || `SAS auth failed with status ${res.status}`;
        throw new Error(msg);
      }

      const text = await res.text();
      const body = safeParseJson<Record<string, any>>(text, {});
      if (!body || !body.token) throw new Error('Invalid SAS response: missing token');

      this.sasSession = {
        token: body.token,
        refreshToken: body.refreshToken,
        expiresAt: Date.now() + (this.sasConfig.sessionTimeout ?? 3_600_000),
        user: body.user ?? {},
      };

      if (this.sasConfig.autoRefresh && this.sasSession.refreshToken) {
        this.setupSessionRefresh();
      }

      if (this.sasConfig.wsEndpoint) {
        this.initializeWebSocketConnection();
      }

      this.emit(BlockchainEvent.SAS_AUTHENTICATION_COMPLETED, this.sasSession);
      return this.sasSession;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.emit(BlockchainEvent.SAS_AUTHENTICATION_FAILED, new Error(message));
      throw err;
    }
  }

  private setupSessionRefresh(): void {
    if (!this.sasSession || !this.sasConfig?.autoRefresh || !this.sasSession.refreshToken) return;

    if (this.sasRefreshTimeout) clearTimeout(this.sasRefreshTimeout);

    const msBefore = Math.max(0, this.sasSession.expiresAt - Date.now() - 300_000); // refresh 5min early
    this.sasRefreshTimeout = setTimeout(async () => {
      try {
        await this.refreshSASSession();
      } catch (err) {
        console.error('Failed to refresh SAS session:', err);
        this.emit(BlockchainEvent.SAS_SESSION_EXPIRED);
        this.cleanupSession();
      }
    }, msBefore);
  }

  private async refreshSASSession(): Promise<void> {
    if (!this.sasSession || !this.sasConfig) throw new Error('No SAS session to refresh');

    const url = this.sasConfig.authEndpoint.replace(/\/$/, '') + '/refresh';
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.sasSession.token}`,
      },
      body: JSON.stringify({ refreshToken: this.sasSession.refreshToken }),
    });

    if (!res.ok) {
      const text = await res.text();
      const errJson = safeParseJson(text, {} as any);
      throw new Error((errJson && (errJson.message || errJson.error)) || `Failed to refresh session (status ${res.status})`);
    }

    const text = await res.text();
    const body = safeParseJson<Record<string, any>>(text, {});
    if (!body || !body.token) throw new Error('Invalid refresh response: missing token');

    this.sasSession = {
      ...this.sasSession,
      token: body.token,
      refreshToken: body.refreshToken ?? this.sasSession.refreshToken,
      expiresAt: Date.now() + (this.sasConfig.sessionTimeout ?? 3_600_000),
    };

    // reset refresh timer
    this.setupSessionRefresh();
  }

  public isAuthenticatedWithSAS(): boolean {
    return !!this.sasSession && this.sasSession.expiresAt > Date.now();
  }

  public getSASSession(): SASSession | null {
    return this.sasSession;
  }

  public async logoutFromSAS(): Promise<void> {
    if (!this.sasSession || !this.sasConfig) {
      this.cleanupSession();
      return;
    }

    try {
      const url = this.sasConfig.authEndpoint.replace(/\/$/, '') + '/logout';
      await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.sasSession.token}` },
      });
    } catch (err) {
      console.warn('Logout error (ignored):', err);
    } finally {
      this.cleanupSession();
    }
  }

  private cleanupSession(): void {
    if (this.sasRefreshTimeout) {
      clearTimeout(this.sasRefreshTimeout);
      this.sasRefreshTimeout = null;
    }
    this.cleanupWebsocket();
    this.sasSession = null;
  }

  /* ---------------------------- WebSocket (SAS) ---------------------------- */

  private initializeWebSocketConnection(): void {
    if (this.ws) {
      console.warn('WebSocket connection already exists');
      return;
    }

    if (!this.sasConfig?.wsEndpoint) {
      console.error('No WebSocket endpoint configured');
      return;
    }

    if (!this.sasSession?.token) {
      console.error('Cannot initialize WebSocket: No active SAS session or token');
      return;
    }

    try {
      this.ws = new (globalThis as any).WebSocket(
        `${this.sasConfig.wsEndpoint}?token=${encodeURIComponent(this.sasSession.token)}`
      );
    } catch (err) {
      console.error('Failed to create WebSocket:', err);
      this.scheduleReconnect();
      return;
    }

if (this.ws) {
  this.ws.onopen = () => {
    this.reconnectAttempts = 0;
    console.log('SAS WebSocket connected');
  };

  this.ws.onmessage = (ev) => {
    try {
      const parsed: SASEvent = JSON.parse((ev as any).data as string);
      this.handleSASEvent(parsed);
    } catch (err) {
      console.error('Invalid WS message:', err);
    }
  };

  this.ws.onclose = () => {
    console.log('SAS WebSocket closed');
    this.ws = null; // <-- ensure cleanup first
    this.scheduleReconnect(); // safe now
  };

  this.ws.onerror = (ev) => {
    console.error('SAS WebSocket error:', ev);
    this.ws?.close(); // optional chaining prevents the TS2531 error
  };
}

  }

  private scheduleReconnect(): void {
    if (!this.sasSession) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max WS reconnect attempts reached');
      return;
    }
    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30_000);
    setTimeout(() => this.initializeWebSocketConnection(), delay);
  }

  private cleanupWebsocket(): void {
    if (!this.ws) return;
    try {
      this.ws.onclose = null;
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.close();
    } catch {
      // ignore
    } finally {
      this.ws = null;
    }
  }

  private handleSASEvent(ev: SASEvent): void {
    switch (ev.type) {
      case 'accountChange':
        if (ev.data?.publicKey) {
          try {
            this.emit(BlockchainEvent.ACCOUNT_CHANGED, new PublicKey(ev.data.publicKey));
          } catch {
            // ignore malformed public key
          }
        }
        break;
      case 'sessionExpired':
        this.emit(BlockchainEvent.SAS_SESSION_EXPIRED);
        this.cleanupSession();
        break;
      case 'transactionConfirmed':
        if (ev.data?.signature) this.emit(BlockchainEvent.TRANSACTION_CONFIRMED, ev.data.signature);
        break;
      case 'transactionFailed':
        this.emit(BlockchainEvent.TRANSACTION_FAILED, new Error(ev.data?.error || 'transaction failed'), ev.data?.signature);
        break;
      default:
        this.emit(`sas:${ev.type}`, ev.data);
        break;
    }
  }

  /* ---------------------- Account & Program Log Listeners ------------------ */

  public async listenToAccountChanges(account: PublicKey, commitment: Commitment = 'confirmed'): Promise<() => void> {
    const key = account.toString();
    if (this.accountChangeListeners.has(key)) {
      const subId = this.accountChangeListeners.get(key)!;
      return () => {
        try {
          this.connection.removeAccountChangeListener(subId);
        } catch (err) {
          console.warn('removeAccountChangeListener failed', err);
        }
      };
    }

    const subId = this.connection.onAccountChange(
      account,
      (info: AccountInfo<Buffer>) => {
        this.emit(BlockchainEvent.ACCOUNT_CHANGED, account);
      },
      commitment
    );

    this.accountChangeListeners.set(key, subId);

    return () => {
      try {
        this.connection.removeAccountChangeListener(subId);
      } catch (err) {
        console.warn('removeAccountChangeListener failed', err);
      }
      this.accountChangeListeners.delete(key);
    };
  }

  public async listenToProgramLogs(callback: (logs: string) => void, commitment: Commitment = 'confirmed'): Promise<() => void> {
    // Remove previous logs subscription if present
    if (this.logsSubscriptionId !== null) {
      try {
        this.connection.removeOnLogsListener(this.logsSubscriptionId);
      } catch {
        // ignore
      } finally {
        this.logsSubscriptionId = null;
      }
    }

    this.logsSubscriptionId = this.connection.onLogs(
      this.programId,
      (logs: Logs) => {
        callback(logs.logs.join('\n'));
      },
      commitment
    );

    return () => {
      if (this.logsSubscriptionId !== null) {
        try {
          this.connection.removeOnLogsListener(this.logsSubscriptionId);
        } catch (err) {
          console.warn('removeOnLogsListener failed', err);
        } finally {
          this.logsSubscriptionId = null;
        }
      }
    };
  }

  /* --------------------------- Transaction Flow --------------------------- */

  private async waitForConfirmation(signature: string, lastValidBlockHeight: number, commitment: Commitment = 'confirmed'): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < this.confirmationTimeout) {
      try {
        const resp = await this.connection.getSignatureStatuses([signature], { searchTransactionHistory: true });
        const info = resp && resp.value && resp.value[0];

        if (info) {
          if (info.err) {
            throw new TransactionFailedError(`Transaction failed: ${JSON.stringify(info.err)}`, undefined, signature);
          }

          const status = info.confirmationStatus;
          if (status === 'confirmed' || status === 'finalized') return;
        }
      } catch (err) {
        if (err instanceof TransactionFailedError) throw err;
        console.error('Error while checking signature status:', err);
      }

      // Check block height / slot expiry
      try {
        const slot = await this.connection.getSlot(commitment);
        if (slot > lastValidBlockHeight) {
          throw new TransactionTimeoutError('Blockhash expired before confirmation', signature);
        }
      } catch (err) {
        // ignore transient slot errors
      }

      await sleep(1000);
    }

    throw new TransactionTimeoutError(`Transaction not confirmed within ${this.confirmationTimeout}ms`, signature);
  }

  /**
   * Send a transaction with retries and confirmation waiting.
   */
  public async sendTransactionWithRetry(
    transaction: Transaction,
    signers: Keypair[] = [],
    options: SendOptions & { retries?: number; commitment?: Commitment } = {}
  ): Promise<{ signature: string; blockhash: string; lastValidBlockHeight: number }> {
    const retries = options.retries ?? this.maxRetries;
    const commitment = (options.commitment as Commitment) ?? 'confirmed';

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash(commitment);
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = this.wallet.publicKey;

        // Signers: wallet (this.wallet) + other provided signers
        const signersToUse = [this.wallet, ...signers.filter(Boolean)];
        transaction.sign(...signersToUse);

        const raw = transaction.serialize();

        const sendOptions: SendOptions = {
          skipPreflight: options.skipPreflight ?? false,
          preflightCommitment: commitment,
        };

        const signature = await this.connection.sendRawTransaction(raw, sendOptions);
        this.emit(BlockchainEvent.TRANSACTION_SENT, signature);

        try {
          await this.waitForConfirmation(signature, lastValidBlockHeight, commitment);
          this.emit(BlockchainEvent.TRANSACTION_CONFIRMED, signature);
          return { signature, blockhash, lastValidBlockHeight };
        } catch (err) {
          this.emit(BlockchainEvent.TRANSACTION_FAILED, err instanceof Error ? err : new Error(String(err)), signature);
          throw err;
        }
      } catch (err) {
        // If fatal known error -> rethrow
        if (err instanceof TransactionFailedError || err instanceof TransactionTimeoutError) throw err;

        if (attempt < retries) {
          const backoff = this.retryDelay * Math.pow(2, attempt);
          const jitter = Math.floor(Math.random() * 500);
          await sleep(backoff + jitter);
          continue;
        } else {
          const message = err instanceof Error ? err.message : String(err);
          throw new BlockchainError(`Failed to send transaction after retries: ${message}`);
        }
      }
    }

    throw new BlockchainError('Failed to send transaction (unknown reason)');
  }

  /* ------------------------- Attestation Helpers ------------------------- */

  private async findAttestationAddress(credentialId: string, attestationType: string): Promise<[PublicKey, number]> {
    const seeds = [Buffer.from('attestation'), Buffer.from(credentialId), Buffer.from(attestationType)];
    return await PublicKey.findProgramAddress(seeds, this.programId);
  }

  public async createAttestation(data: AttestationData): Promise<{ success: boolean; transactionId?: string; error?: string; attestationAddress?: string }> {
    try {
      const [attestationAddress] = await this.findAttestationAddress(data.credentialId, data.attestationType);

      const instruction = new TransactionInstruction({
        programId: this.programId,
        keys: [
          { pubkey: attestationAddress, isSigner: false, isWritable: true },
          { pubkey: new PublicKey(data.studentId), isSigner: false, isWritable: false },
          { pubkey: new PublicKey(data.universityId), isSigner: false, isWritable: false },
          { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
        ],
        data: Buffer.from(JSON.stringify({ type: 'create_attestation', ...data }), 'utf-8'),
      });

      const tx = new Transaction().add(instruction);
      const { signature } = await this.sendTransactionWithRetry(tx, []);
      return { success: true, transactionId: signature, attestationAddress: attestationAddress.toString() };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('createAttestation error:', err);
      return { success: false, error: msg };
    }
  }

  private parseAttestationData(raw: Buffer | Uint8Array): AttestationAccountData | null {
    try {
      const s = Buffer.from(raw).toString('utf-8').trim();
      if (!s) return null;
      const parsed = JSON.parse(s) as AttestationAccountData;
      if (!parsed.credentialId || !parsed.studentId || !parsed.universityId) return null;
      return { timestamp: parsed.timestamp ?? Date.now(), issuer: parsed.issuer ?? this.wallet.publicKey.toString(), ...parsed };
    } catch (err) {
      console.error('parseAttestationData failed:', err);
      return null;
    }
  }

  private validateAttestationStructure(data: AttestationAccountData | null): boolean {
    if (!data) return false;
    if (typeof data.credentialId !== 'string') return false;
    if (typeof data.studentId !== 'string') return false;
    if (typeof data.universityId !== 'string') return false;
    if (!['UNIVERSITY_ISSUED', 'GOVERNMENT_ACCREDITED'].includes(data.attestationType)) return false;
    if (data.timestamp && (typeof data.timestamp !== 'number' || data.timestamp > Date.now())) return false;
    return true;
  }

  public async verifyAttestation(attestationAddress: string): Promise<{ isValid: boolean; data?: any; error?: string }> {
    try {
      if (!attestationAddress) return { isValid: false, error: 'Invalid attestation address' };

      let pubKey: PublicKey;
      try {
        pubKey = new PublicKey(attestationAddress);
      } catch {
        return { isValid: false, error: 'Invalid attestation address format' };
      }

      const accountInfo = await this.connection.getAccountInfo(pubKey);
      if (!accountInfo) return { isValid: false, error: 'Attestation account not found' };

      if (!accountInfo.owner.equals(this.programId)) {
        return { isValid: false, error: 'Attestation account is not owned by expected program' };
      }

      const parsed = this.parseAttestationData(accountInfo.data);
      const ok = this.validateAttestationStructure(parsed);
      return ok ? { isValid: true, data: parsed } : { isValid: false, error: 'Attestation data invalid or malformed' };
    } catch (err) {
      console.error('verifyAttestation error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      return { isValid: false, error: `Verification failed: ${msg}` };
    }
  }

  public async batchVerifyAttestations(attestationAddresses: string[]): Promise<Record<string, { isValid: boolean; data?: any; error?: string }>> {
    const results: Record<string, { isValid: boolean; data?: any; error?: string }> = {};
    const BATCH_SIZE = 10;

    for (let i = 0; i < attestationAddresses.length; i += BATCH_SIZE) {
      const batch = attestationAddresses.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(async (addr) => {
          try {
            const res = await this.verifyAttestation(addr);
            return { addr, res };
          } catch (err) {
            return { addr, res: { isValid: false, error: err instanceof Error ? err.message : String(err) } };
          }
        })
      );

      batchResults.forEach(({ addr, res }) => (results[addr] = res));

      if (i + BATCH_SIZE < attestationAddresses.length) await sleep(500);
    }

    return results;
  }

  /* ----------------------------- Utilities -------------------------------- */

  public async estimateTransactionCost(tx: Transaction): Promise<number> {
    try {
      const { blockhash } = await this.connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = this.wallet.publicKey;
      const message = tx.compileMessage();
      const feeResponse = await this.connection.getFeeForMessage(message);
      return feeResponse.value ?? 0;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('estimateTransactionCost error:', err);
      throw new Error(`Failed to estimate transaction cost: ${msg}`);
    }
  }

  public async shutdown(): Promise<void> {
    // remove account listeners
    for (const [key, id] of this.accountChangeListeners.entries()) {
      try {
        this.connection.removeAccountChangeListener(id);
      } catch (err) {
        console.warn('removeAccountChangeListener failed for', key, err);
      }
    }
    this.accountChangeListeners.clear();

    // remove logs listener
    if (this.logsSubscriptionId !== null) {
      try {
        this.connection.removeOnLogsListener(this.logsSubscriptionId);
      } catch (err) {
        console.warn('removeOnLogsListener failed', err);
      } finally {
        this.logsSubscriptionId = null;
      }
    }

    // cleanup SAS and WS
    this.cleanupSession();

    // remove all EventEmitter listeners
    this.removeAllListeners();
  }
}

/* --------------------------- Module Helpers ------------------------------- */

/**
 * Safely parse JSON and return fallback on failure.
 * Keep this at module scope so every method can use it.
 */
function safeParseJson<T = unknown>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
