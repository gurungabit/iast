// ============================================================================
// Encryption Service - AES-256-GCM encryption for sensitive data
// ============================================================================
//
// Uses AES-256-GCM for authenticated encryption of stored credentials.
// Requires CREDENTIALS_ENCRYPTION_KEY environment variable (32 bytes hex).
//
// ============================================================================

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

// ============================================================================
// Configuration
// ============================================================================

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM recommended IV length
const AUTH_TAG_LENGTH = 16;

/**
 * Get the encryption key from environment
 * @returns Buffer containing 32-byte key
 * @throws Error if key is missing or invalid
 */
function getEncryptionKey(): Buffer {
  const keyHex = process.env.CREDENTIALS_ENCRYPTION_KEY;

  if (!keyHex) {
    throw new Error('CREDENTIALS_ENCRYPTION_KEY not configured');
  }

  const key = Buffer.from(keyHex, 'hex');

  if (key.length !== 32) {
    throw new Error('CREDENTIALS_ENCRYPTION_KEY must be 32 bytes (64 hex characters)');
  }

  return key;
}

// ============================================================================
// Types
// ============================================================================

export interface EncryptedData {
  /** Base64-encoded IV */
  iv: string;
  /** Base64-encoded ciphertext */
  ciphertext: string;
  /** Base64-encoded auth tag */
  tag: string;
}

// ============================================================================
// Functions
// ============================================================================

/**
 * Check if encryption is configured
 */
export function isEncryptionConfigured(): boolean {
  const keyHex = process.env.CREDENTIALS_ENCRYPTION_KEY;

  if (!keyHex) {
    console.log('[Encryption] CREDENTIALS_ENCRYPTION_KEY not set in environment');
    return false;
  }

  try {
    const key = Buffer.from(keyHex, 'hex');
    const valid = key.length === 32;
    console.log(`[Encryption] Key configured: ${String(valid)} (${String(key.length)} bytes)`);
    return valid;
  } catch (e) {
    console.log('[Encryption] Failed to parse key:', e);
    return false;
  }
}

/**
 * Encrypt sensitive data using AES-256-GCM
 * 
 * @param plaintext - The string to encrypt
 * @returns Encrypted data object with iv, ciphertext, and tag
 */
export function encrypt(plaintext: string): EncryptedData {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  return {
    iv: iv.toString('base64'),
    ciphertext: encrypted.toString('base64'),
    tag: tag.toString('base64'),
  };
}

/**
 * Decrypt data encrypted with AES-256-GCM
 * 
 * @param data - Encrypted data object
 * @returns Decrypted plaintext string
 */
export function decrypt(data: EncryptedData): string {
  const key = getEncryptionKey();

  const iv = Buffer.from(data.iv, 'base64');
  const ciphertext = Buffer.from(data.ciphertext, 'base64');
  const tag = Buffer.from(data.tag, 'base64');

  const decipher = createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

/**
 * Encrypt credentials object
 * 
 * @param credentials - Object with username and password
 * @returns Encrypted credentials string (JSON with encrypted password)
 */
export function encryptCredentials(credentials: { username: string; password: string }): EncryptedData {
  // Encrypt the entire credentials object as JSON
  return encrypt(JSON.stringify(credentials));
}

/**
 * Decrypt credentials
 * 
 * @param encryptedCredentials - Encrypted credentials data
 * @returns Decrypted credentials object
 */
export function decryptCredentials(encryptedCredentials: EncryptedData): { username: string; password: string } {
  const json = decrypt(encryptedCredentials);
  return JSON.parse(json) as { username: string; password: string };
}
