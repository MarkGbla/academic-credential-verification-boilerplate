import { ICredentialRepository } from '../database/repositories';
import { VerificationService } from './VerificationService';
import { NotificationService } from './NotificationService';
import { AttestationService } from './AttestationService';

export interface BatchVerificationResult {
  batchId: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  total: number;
  processed: number;
  valid: number;
  invalid: number;
  results: Array<{
    credentialId: string;
    status: 'VALID' | 'INVALID' | 'ERROR';
    error?: string;
    timestamp: Date;
  }>;
  startedAt: Date;
  completedAt?: Date;
  metadata?: Record<string, any>;
}

export class BatchVerificationService {
  private batchJobs: Map<string, BatchVerificationResult> = new Map();
  private readonly BATCH_SIZE = 50; // Process 50 credentials at a time

  constructor(
    private credentialRepo: ICredentialRepository,
    private verificationService: VerificationService,
    private notificationService: NotificationService,
    private attestationService: AttestationService
  ) {}

  /**
   * Start a new batch verification job
   */
  async startBatchVerification(
    credentialIds: string[],
    options: {
      notifyOnComplete?: boolean;
      notifyEmail?: string;
      priority?: 'low' | 'normal' | 'high';
      metadata?: Record<string, any>;
    } = {}
  ): Promise<{ batchId: string }> {
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const batchJob: BatchVerificationResult = {
      batchId,
      status: 'PENDING',
      total: credentialIds.length,
      processed: 0,
      valid: 0,
      invalid: 0,
      results: [],
      startedAt: new Date(),
      metadata: options.metadata,
    };

    this.batchJobs.set(batchId, batchJob);

    // Process the batch asynchronously
    this.processBatch(batchId, credentialIds, options).catch(console.error);

    return { batchId };
  }

  /**
   * Get the status of a batch verification job
   */
  getBatchStatus(batchId: string): BatchVerificationResult | null {
    return this.batchJobs.get(batchId) || null;
  }

  /**
   * Process a batch of credentials
   */
  private async processBatch(
    batchId: string,
    credentialIds: string[],
    options: {
      notifyOnComplete?: boolean;
      notifyEmail?: string;
      priority?: 'low' | 'normal' | 'high';
    }
  ) {
    const batchJob = this.batchJobs.get(batchId);
    if (!batchJob) return;

    batchJob.status = 'PROCESSING';

    try {
      // Process credentials in batches
      for (let i = 0; i < credentialIds.length; i += this.BATCH_SIZE) {
        const batch = credentialIds.slice(i, i + this.BATCH_SIZE);
        
        // Process each credential in the current batch
        const results = await Promise.allSettled(
          batch.map(credentialId => this.verifyCredential(credentialId))
        );

        // Update batch job status
        results.forEach((result, index) => {
          const credentialId = batch[index];
          
          if (result.status === 'fulfilled') {
            const { isValid } = result.value;
            batchJob.results.push({
              credentialId,
              status: isValid ? 'VALID' : 'INVALID',
              timestamp: new Date(),
            });
            
            if (isValid) batchJob.valid++;
            else batchJob.invalid++;
          } else {
            batchJob.results.push({
              credentialId,
              status: 'ERROR',
              error: result.reason.message,
              timestamp: new Date(),
            });
            batchJob.invalid++;
          }
          
          batchJob.processed++;
        });
      }

      // Mark batch as completed
      batchJob.status = 'COMPLETED';
      batchJob.completedAt = new Date();

      // Send notification if requested
      if (options.notifyOnComplete && options.notifyEmail) {
        await this.notificationService.send({
          type: 'EMAIL',
          to: options.notifyEmail,
          template: 'BATCH_COMPLETE',
          data: {
            batchId,
            total: batchJob.total,
            valid: batchJob.valid,
            invalid: batchJob.invalid,
            completionTime: batchJob.completedAt.toISOString(),
          },
        });
      }
    } catch (error) {
      console.error(`Error processing batch ${batchId}:`, error);
      
      if (this.batchJobs.has(batchId)) {
        const batchJob = this.batchJobs.get(batchId)!;
        batchJob.status = 'FAILED';
        batchJob.completedAt = new Date();
        
        if (options.notifyOnComplete && options.notifyEmail) {
          await this.notificationService.send({
            type: 'EMAIL',
            to: options.notifyEmail,
            template: 'BATCH_FAILED',
            data: {
              batchId,
              error: error.message,
              processed: batchJob.processed,
              total: batchJob.total,
            },
          });
        }
      }
    }
  }

  /**
   * Verify a single credential
   */
  private async verifyCredential(credentialId: string): Promise<{ isValid: boolean }> {
    try {
      // First, do a quick verification
      const { isValid: quickValid } = await this.verificationService.quickVerifyCredential(credentialId);
      if (!quickValid) {
        return { isValid: false };
      }

      // Then, verify the attestation chain
      const { isAuthentic } = await this.attestationService.verifyCredentialAuthenticity(credentialId);
      if (!isAuthentic) {
        return { isValid: false };
      }

      return { isValid: true };
    } catch (error) {
      console.error(`Error verifying credential ${credentialId}:`, error);
      throw error;
    }
  }

  /**
   * Get all batch jobs
   */
  listBatchJobs(limit: number = 50): BatchVerificationResult[] {
    return Array.from(this.batchJobs.values())
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
      .slice(0, limit);
  }

  /**
   * Clean up completed batch jobs
   */
  cleanupCompletedJobs(olderThanDays: number = 7): number {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);

    let count = 0;
    for (const [batchId, job] of this.batchJobs.entries()) {
      if (job.status === 'COMPLETED' && job.completedAt && job.completedAt < cutoff) {
        this.batchJobs.delete(batchId);
        count++;
      }
    }

    return count;
  }
}
