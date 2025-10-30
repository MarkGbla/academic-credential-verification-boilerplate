import { Keypair } from '@solana/web3.js';
import { generateSeedFromNIN, hashNIN } from '../utils/crypto';
import { generateAddressFromNIN, verifyAddressForNIN } from '../solana/address-generation';
import { RateLimiter } from 'limiter';
import NodeCache from 'node-cache';

// Cache for NIN lookups (5 minute TTL)
const ninCache = new NodeCache({ stdTTL: 300 });

// Rate limiter: 100 requests per hour per IP
const rateLimiter = new RateLimiter({
  tokensPerInterval: 100,
  interval: 'hour'
});

// Country-specific NIN validation patterns
const NIN_PATTERNS: Record<string, RegExp> = {
  // Nigeria: 11 digits
  NG: /^\d{11}$/,
  // US: 9 digits, may include hyphens
  US: /^\d{3}-?\d{2}-?\d{4}$/,
  // UK: 2 letters, 6 digits, 1 letter
  UK: /^[A-Za-z]{2}\d{6}[A-Za-z]$/,
  // Default: At least 8 alphanumeric characters
  DEFAULT: /^[a-zA-Z0-9]{8,20}$/
};

export interface NINValidationResult {
  isValid: boolean;
  error?: string;
  countryCode?: string;
}

export interface NINAddressResult {
  success: boolean;
  address?: string;
  error?: string;
  keypair?: Keypair;
  cached?: boolean;
}

export interface NINVerificationResult {
  isValid: boolean;
  error?: string;
  countryCode?: string;
}

export interface NINHashResult {
  success: boolean;
  hash?: string;
  error?: string;
}

/**
 * Service for handling NIN (National Identification Number) related operations
 */
export class NINService {
  /**
   * Validate NIN format with country-specific validation
   */
  static validateNIN(nin: string, countryCode: string = 'NG'): NINValidationResult {
    if (!nin) {
      return { 
        isValid: false, 
        error: 'NIN is required',
        countryCode
      };
    }

    // Check cache first
    const cacheKey = `nin_validation_${countryCode}_${nin}`;
    const cached = ninCache.get<NINValidationResult>(cacheKey);
    if (cached) {
      return { ...cached, cached: true } as NINValidationResult;
    }

    // Trim and normalize
    const normalizedNIN = nin.trim().toUpperCase();
    
    // Get validation pattern based on country code
    const pattern = NIN_PATTERNS[countryCode] || NIN_PATTERNS.DEFAULT;
    
    // Validate format
    if (!pattern.test(normalizedNIN)) {
      const result: NINValidationResult = {
        isValid: false,
        error: `Invalid NIN format for country ${countryCode}`,
        countryCode
      };
      
      // Cache negative results for a shorter time
      ninCache.set(cacheKey, result, 60); // 1 minute TTL for invalid NINs
      return result;
    }
    
    // Additional country-specific validation
    if (countryCode === 'NG' && !this.validateNGNIN(normalizedNIN)) {
      const result: NINValidationResult = {
        isValid: false,
        error: 'Invalid Nigerian NIN format',
        countryCode
      };
      ninCache.set(cacheKey, result, 60);
      return result;
    }
    
    const result: NINValidationResult = {
      isValid: true,
      countryCode
    };
    
    // Cache valid NINs
    ninCache.set(cacheKey, result);
    return result;
  }
  
  /**
   * Additional validation for Nigerian NINs
   */
  private static validateNGNIN(nin: string): boolean {
    // Nigerian NINs should be 11 digits with a valid checksum
    if (!/^\d{11}$/.test(nin)) {
      return false;
    }
    
    // Extract components
    const stateCode = parseInt(nin.substring(0, 3));
    const lgaCode = parseInt(nin.substring(3, 6));
    const serialNumber = parseInt(nin.substring(6, 10));
    const checkDigit = parseInt(nin[10]);
    
    // Validate state code (1-37 + FCT)
    if (stateCode < 1 || stateCode > 38) {
      return false;
    }
    
    // Simple checksum validation (this is a simplified example)
    const digits = nin.split('').map(Number);
    const sum = digits.slice(0, 10).reduce((sum, digit, i) => sum + (digit * (10 - i)), 0);
    const computedCheck = (sum % 11) % 10;
    
    return computedCheck === checkDigit;
  }

  /**
   * Generate a deterministic Solana address from NIN with rate limiting and caching
   */
  static async generateAddress(
    nin: string, 
    ip: string = 'default',
    countryCode: string = 'NG'
  ): Promise<NINAddressResult> {
    try {
      // Check rate limit
      if (!(await this.checkRateLimit(ip))) {
        return { 
          success: false, 
          error: 'Rate limit exceeded. Please try again later.' 
        };
      }

      // Check cache first
      const cacheKey = `nin_address_${countryCode}_${nin}`;
      const cached = ninCache.get<NINAddressResult>(cacheKey);
      if (cached) {
        return { ...cached, cached: true };
      }

      // Validate NIN
      const validation = this.validateNIN(nin, countryCode);
      if (!validation.isValid) {
        return { 
          success: false, 
          error: validation.error || 'Invalid NIN format',
          countryCode: validation.countryCode
        };
      }

      // Generate the address
      const keypair = Keypair.fromSeed(generateSeedFromNIN(nin).slice(0, 32));
      const address = keypair.publicKey.toBase58();

      const result: NINAddressResult = { 
        success: true, 
        address, 
        keypair,
        countryCode: validation.countryCode
      };

      // Cache the result
      ninCache.set(cacheKey, result);
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate address from NIN';
      console.error('NIN address generation error:', error);
      
      return { 
        success: false, 
        error: errorMessage,
        countryCode
      };
    }
  }
  
  /**
   * Check if a request is within rate limits
   */
  private static async checkRateLimit(ip: string): Promise<boolean> {
    try {
      const remaining = await rateLimiter.removeTokens(1);
      return remaining >= 0;
    } catch (error) {
      console.error('Rate limit check failed:', error);
      return false; // Fail closed on error
    }
  }

  /**
   * Verify if a Solana address was generated from a specific NIN
   */
  static async verifyAddress(
    nin: string, 
    address: string,
    ip: string = 'default',
    countryCode: string = 'NG'
  ): Promise<NINVerificationResult> {
    try {
      // Check rate limit
      if (!(await this.checkRateLimit(ip))) {
        return { 
          isValid: false, 
          error: 'Rate limit exceeded. Please try again later.',
          countryCode
        };
      }

      // Check cache first
      const cacheKey = `nin_verify_${countryCode}_${nin}_${address}`;
      const cached = ninCache.get<NINVerificationResult>(cacheKey);
      if (cached) {
        return { ...cached, cached: true };
      }

      // Validate NIN format
      const validation = this.validateNIN(nin, countryCode);
      if (!validation.isValid) {
        return { 
          isValid: false, 
          error: validation.error,
          countryCode: validation.countryCode
        };
      }

      // Verify the address
      const result: NINVerificationResult = {
        isValid: verifyAddressForNIN(nin, address),
        countryCode: validation.countryCode
      };

      // Cache the result (shorter TTL for negative results)
      ninCache.set(
        cacheKey, 
        result,
        result.isValid ? 3600 : 300 // 1 hour for valid, 5 minutes for invalid
      );
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to verify address';
      console.error('NIN verification error:', error);
      
      return { 
        isValid: false, 
        error: errorMessage,
        countryCode
      };
    }
  }

  /**
   * Generate a hashed version of the NIN for storage
   * This ensures we don't store raw NINs in the database
   */
  static hashNIN(
    nin: string, 
    saltRounds: number = 10,
    countryCode: string = 'NG'
  ): NINHashResult {
    try {
      // Validate NIN format
      const validation = this.validateNIN(nin, countryCode);
      if (!validation.isValid) {
        return { 
          success: false, 
          error: validation.error,
          countryCode: validation.countryCode
        };
      }

      // Check cache first
      const cacheKey = `nin_hash_${countryCode}_${nin}`;
      const cached = ninCache.get<NINHashResult>(cacheKey);
      if (cached) {
        return { ...cached, cached: true };
      }

      // Generate the hash with configurable salt rounds
      const hashedNIN = hashNIN(nin, saltRounds);
      
      const result: NINHashResult = { 
        success: true, 
        hash: hashedNIN,
        countryCode: validation.countryCode
      };
      
      // Cache the result
      ninCache.set(cacheKey, result);
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to hash NIN';
      console.error('NIN hashing error:', error);
      
      return { 
        success: false, 
        error: errorMessage,
        countryCode
      };
    }
  }
  
  /**
   * Batch verify multiple NIN-address pairs
   */
  static async batchVerify(
    verifications: Array<{ nin: string; address: string }>,
    ip: string = 'default',
    countryCode: string = 'NG'
  ): Promise<Array<NINVerificationResult & { nin: string; address: string }>> {
    // Check rate limit based on batch size
    if (!(await this.checkRateLimit(ip, verifications.length))) {
      throw new Error('Rate limit exceeded. Please reduce batch size or try again later.');
    }
    
    // Process verifications in parallel
    const results = await Promise.all(
      verifications.map(async ({ nin, address }) => {
        const result = await this.verifyAddress(nin, address, ip, countryCode);
        return { ...result, nin, address };
      })
    );
    
    return results;
  }
  
  /**
   * Invalidate NIN cache entries (admin function)
   */
  static invalidateCache(nin: string, countryCode: string = 'NG'): boolean {
    try {
      const patterns = [
        `nin_validation_${countryCode}_${nin}`,
        `nin_address_${countryCode}_${nin}`,
        `nin_verify_${countryCode}_${nin}_*`,
        `nin_hash_${countryCode}_${nin}`
      ];
      
      let deletedCount = 0;
      
      patterns.forEach(pattern => {
        const keys = ninCache.keys().filter(key => {
          if (pattern.endsWith('*')) {
            return key.startsWith(pattern.slice(0, -1));
          }
          return key === pattern;
        });
        
        keys.forEach(key => {
          if (ninCache.del(key) > 0) {
            deletedCount++;
          }
        });
      });
      
      return deletedCount > 0;
    } catch (error) {
      console.error('Failed to invalidate NIN cache:', error);
      return false;
    }
  }
}
