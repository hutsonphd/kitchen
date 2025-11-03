/**
 * Encryption utilities for credential storage
 * Compatible with frontend CryptoJS AES encryption
 */

import crypto from 'crypto';

// Same key as frontend for compatibility
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'kitchen-kiosk-calendar-key';

/**
 * Encrypt password using AES-256-CBC
 * Compatible with CryptoJS.AES format
 */
export const encryptPassword = (password) => {
  if (!password) return '';

  try {
    // Create key and IV from passphrase (compatible with CryptoJS)
    const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
    const iv = crypto.randomBytes(16);

    // Encrypt
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(password, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    // Combine IV and encrypted data (CryptoJS format)
    const result = Buffer.concat([
      Buffer.from('Salted__'),
      iv,
      Buffer.from(encrypted, 'base64')
    ]).toString('base64');

    return result;
  } catch (error) {
    console.error('[Crypto] Encryption failed:', error.message);
    throw new Error('Failed to encrypt password');
  }
};

/**
 * Decrypt password using AES-256-CBC
 * Compatible with CryptoJS.AES format
 */
export const decryptPassword = (encrypted) => {
  if (!encrypted) return '';

  try {
    // Decode base64
    const ciphertext = Buffer.from(encrypted, 'base64');

    // Extract IV (skip 'Salted__' prefix)
    const iv = ciphertext.slice(8, 24);
    const encryptedData = ciphertext.slice(24);

    // Create key from passphrase
    const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();

    // Decrypt
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedData, undefined, 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('[Crypto] Decryption failed:', error.message);
    throw new Error('Failed to decrypt password');
  }
};
