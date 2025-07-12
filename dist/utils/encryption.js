"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EncryptionService = void 0;
const crypto_1 = __importDefault(require("crypto"));
class EncryptionService {
    /**
     * Get encryption key from environment or generate a default one
     */
    static getEncryptionKey() {
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
    static encrypt(text) {
        try {
            const key = this.getEncryptionKey();
            const iv = crypto_1.default.randomBytes(16);
            const cipher = crypto_1.default.createCipheriv(this.ALGORITHM, key, iv);
            let encrypted = cipher.update(text, 'utf8', this.ENCODING);
            encrypted += cipher.final(this.ENCODING);
            // Return IV + encrypted data
            return iv.toString(this.ENCODING) + ':' + encrypted;
        }
        catch (error) {
            console.error('Encryption error:', error);
            throw new Error('Failed to encrypt data');
        }
    }
    /**
     * Decrypt a string
     */
    static decrypt(encryptedText) {
        try {
            const key = this.getEncryptionKey();
            const textParts = encryptedText.split(':');
            const iv = Buffer.from(textParts.shift(), this.ENCODING);
            const encryptedData = textParts.join(':');
            const decipher = crypto_1.default.createDecipheriv(this.ALGORITHM, key, iv);
            let decrypted = decipher.update(encryptedData, this.ENCODING, 'utf8');
            decrypted += decipher.final('utf8');
            return decrypted;
        }
        catch (error) {
            console.error('Decryption error:', error);
            throw new Error('Failed to decrypt data');
        }
    }
    /**
     * Hash a string (for non-reversible operations)
     */
    static hash(text) {
        return crypto_1.default.createHash('sha256').update(text).digest('hex');
    }
    /**
     * Generate a random string
     */
    static generateRandomString(length = 32) {
        return crypto_1.default.randomBytes(length).toString('hex');
    }
}
exports.EncryptionService = EncryptionService;
EncryptionService.ALGORITHM = 'aes-256-cbc';
EncryptionService.ENCODING = 'hex';
//# sourceMappingURL=encryption.js.map