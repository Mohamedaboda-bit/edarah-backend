export interface ValidationResult {
    isValid: boolean;
    errors: string[];
}
export declare class ValidationUtils {
    /**
     * Validate email format
     */
    static isValidEmail(email: string): boolean;
    /**
     * Validate password strength
     */
    static isValidPassword(password: string): ValidationResult;
    /**
     * Validate phone number format
     */
    static isValidPhoneNumber(phone: string): boolean;
    /**
     * Validate registration input
     */
    static validateRegistrationInput(data: {
        firstName: string;
        lastName: string;
        email: string;
        password: string;
        phoneNumber: string;
    }): ValidationResult;
    /**
     * Validate login input
     */
    static validateLoginInput(data: {
        email: string;
        password: string;
    }): ValidationResult;
    static validateAddPlanInput(data: {
        name: any;
        features: any;
        price: any;
        is_active: any;
        token_limit: any;
    }): ValidationResult;
}
//# sourceMappingURL=validation.d.ts.map