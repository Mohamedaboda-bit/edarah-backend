import crypto from 'crypto';

export class EncryptionService {
  private static readonly ALGORITHM = 'aes-256-cbc';
  private static readonly ENCODING = 'hex';
  
  /**
   * Get encryption key from environment or generate a default one
   */
  private static getEncryptionKey(): string {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
      console.warn('ENCRYPTION_KEY not found in environment variables. Using default key (not recommended for production).');
      return 'your-32-character-secret-key-here!!'; // 32 characters for AES-256
    }
    return key;
  }

  /**
   * Encrypt a string
   */
  static encrypt(text: string): string {
    try {
      const key = this.getEncryptionKey();
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);
      
      let encrypted = cipher.update(text, 'utf8', this.ENCODING);
      encrypted += cipher.final(this.ENCODING);
      
      // Return IV + encrypted data
      return iv.toString(this.ENCODING) + ':' + encrypted;
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt a string
   */
  static decrypt(encryptedText: string): string {
    try {
      const key = this.getEncryptionKey();
      const textParts = encryptedText.split(':');
      const iv = Buffer.from(textParts.shift()!, this.ENCODING);
      const encryptedData = textParts.join(':');
      
      const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv);
      let decrypted = decipher.update(encryptedData, this.ENCODING, 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Hash a string (for non-reversible operations)
   */
  static hash(text: string): string {
    return crypto.createHash('sha256').update(text).digest('hex');
  }

  /**
   * Generate a random string
   */
  static generateRandomString(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }
} 