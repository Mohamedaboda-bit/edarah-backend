export declare class EncryptionService {
    private static readonly ALGORITHM;
    private static readonly ENCODING;
    /**
     * Get encryption key from environment or generate a default one
     */
    private static getEncryptionKey;
    /**
     * Encrypt a string
     */
    static encrypt(text: string): string;
    /**
     * Decrypt a string
     */
    static decrypt(encryptedText: string): string;
    /**
     * Hash a string (for non-reversible operations)
     */
    static hash(text: string): string;
    /**
     * Generate a random string
     */
    static generateRandomString(length?: number): string;
}
//# sourceMappingURL=encryption.d.ts.map