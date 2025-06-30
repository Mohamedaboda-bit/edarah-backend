import { PlanName } from '@prisma/client';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export class ValidationUtils {
  /**
   * Validate email format
   */
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate password strength
   */
  static isValidPassword(password: string): ValidationResult {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate phone number format
   */
  static isValidPhoneNumber(phone: string): boolean {
    // Basic phone number validation (can be enhanced based on requirements)
    const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
    return phoneRegex.test(phone);
  }

  /**
   * Validate registration input
   */
  static validateRegistrationInput(data: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    phoneNumber: string;
  }): ValidationResult {
    const errors: string[] = [];

    // Check required fields
    if (!data.firstName?.trim()) {
      errors.push('First name is required');
    }

    if (!data.lastName?.trim()) {
      errors.push('Last name is required');
    }

    if (!data.email?.trim()) {
      errors.push('Email is required');
    } else if (!this.isValidEmail(data.email)) {
      errors.push('Invalid email format');
    }

    if (!data.password) {
      errors.push('Password is required');
    } else {
      const passwordValidation = this.isValidPassword(data.password);
      if (!passwordValidation.isValid) {
        errors.push(...passwordValidation.errors);
      }
    }

    if (!data.phoneNumber?.trim()) {
      errors.push('Phone number is required');
    } else if (!this.isValidPhoneNumber(data.phoneNumber)) {
      errors.push('Invalid phone number format');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate login input
   */
  static validateLoginInput(data: {
    email: string;
    password: string;
  }): ValidationResult {
    const errors: string[] = [];

    if (!data.email?.trim()) {
      errors.push('Email is required');
    } else if (!this.isValidEmail(data.email)) {
      errors.push('Invalid email format');
    }

    if (!data.password?.trim()) {
      errors.push('Password is required');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static validateAddPlanInput(data: {
    name: any;
    features: any;
    price: any;
    is_active: any;
    token_limit: any;
  }): ValidationResult {
    const errors: string[] = [];

    if (!data.name) {
      errors.push('Plan name is required.');
    } else if (!Object.values(PlanName).includes(data.name)) {
      errors.push(`Invalid plan name. Must be one of: ${Object.values(PlanName).join(', ')}`);
    }

    if (data.price === undefined || data.price === null || data.price === '') {
      errors.push('Price is required.');
    } else {
      const parsedPrice = Number(data.price);
      if (isNaN(parsedPrice)) {
        errors.push('Price must be a valid number.');
      } else {
        data.price = parsedPrice;
      }
    }

    if (data.is_active === undefined) {
      errors.push('is_active is required.');
    } else if (typeof data.is_active === 'string') {
      if (data.is_active.toLowerCase() === 'true') {
        data.is_active = true;
      } else if (data.is_active.toLowerCase() === 'false') {
        data.is_active = false;
      } else {
        errors.push('is_active must be a boolean value or "true" or "false".');
      }
    } else if (typeof data.is_active !== 'boolean') {
      errors.push('is_active must be a boolean.');
    }

    if (data.token_limit === undefined || data.token_limit === null || data.token_limit === '') {
      errors.push('Token limit is required.');
    } else {
      const parsedTokenLimit = Number(data.token_limit);
      if (!Number.isInteger(parsedTokenLimit)) {
        errors.push('Token limit must be a valid integer.');
      } else {
        data.token_limit = parsedTokenLimit;
      }
    }

    if (!data.features) {
      errors.push('Features are required.');
    } else if (typeof data.features !== 'object' || Array.isArray(data.features) || data.features === null) {
      errors.push('Features must be an object.');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

