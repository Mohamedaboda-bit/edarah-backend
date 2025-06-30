import { PrismaClient, UserRole } from '@prisma/client';
import { AuthUtils } from '../utils/auth';
import { ValidationUtils } from '../utils/validation';
import { Request, Response } from 'express';

const prisma = new PrismaClient();

export const register = async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, email, password, phoneNumber } = req.body;
    
    // Validate input
    const validation = ValidationUtils.validateRegistrationInput({
      firstName,
      lastName,
      email,
      password,
      phoneNumber
    });

    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Please check your input',
        details: validation.errors
      });
    }

    // Check if user already exists
    const existingUser = await prisma.users.findFirst({
      where: { email: email.toLowerCase() }
    });

    if (existingUser) {
      return res.status(409).json({
        error: 'User already exists',
        message: 'A user with this email already exists'
      });
    }


    // Hash password
    const hashedPassword = await AuthUtils.hashPassword(password);

    // Create user
    const newUser = await prisma.users.create({
      data: {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        phone_number: phoneNumber.trim(),
        role: UserRole.client,
        created_at: new Date(),
        updated_at: new Date()
      }
    });

    // Generate JWT token
    const token = AuthUtils.generateToken({
      userId: newUser.id.toString(),
      email: newUser.email,
      role: newUser.role,
      firstName:newUser.first_name,
      lastName:newUser.last_name,
      phoneNumber:newUser.phone_number
    });

    // Return user data (without password) and token
    const { password: _, ...userWithoutPassword } = newUser;

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        ...userWithoutPassword,
        id: userWithoutPassword.id.toString()
      },
      token
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: 'Registration failed',
      message: 'An error occurred during registration'
    });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Validate input
    const validation = ValidationUtils.validateLoginInput({ email, password });

    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Please check your input',
        details: validation.errors
      });
    }

    // Find user by email
    const user = await prisma.users.findFirst({
      where: { email: email.toLowerCase() }
    });

    if (!user) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect'
      });
    }

    // Verify password
    const isPasswordValid = await AuthUtils.comparePassword(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect'
      });
    }

    // Generate JWT token
    const token = AuthUtils.generateToken({
      userId: user.id.toString(),
      email: user.email,
      role: user.role,
      firstName:user.first_name,
      lastName:user.last_name,
      phoneNumber:user.phone_number
    });

    // Update last login timestamp
    await prisma.users.update({
      where: { id: user.id },
      data: { updated_at: new Date() }
    });

    // Return user data (without password) and token
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      message: 'Login successful',
      user: {
        ...userWithoutPassword,
        id: userWithoutPassword.id.toString()
      },
      token
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Login failed',
      message: 'An error occurred during login'
    });
  }
};

export const getProfile = async (req: Request, res: Response) => {
  try {
    const userId = BigInt((req as any).user!.userId);

    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        email: true,
        role: true,
        phone_number: true,
        created_at: true,
        updated_at: true
      }
    });

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User profile not found'
      });
    }

    res.json({
      user: {
        ...user,
        id: user.id.toString()
      }
    });

  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({
      error: 'Profile fetch failed',
      message: 'An error occurred while fetching profile'
    });
  }
};

export const logout = (req: Request, res: Response) => {
  res.json({
    message: 'Logout successful',
    note: 'Please remove the token from client storage'
  });
};

export const refreshToken = async (req: Request, res: Response) => {
  try {
    const userId = BigInt((req as any).user!.userId);

    // Verify user still exists
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        first_name: true,
        last_name:true,
        phone_number:true
      }
    });

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User no longer exists'
      });
    }

    // Generate new token
    const newToken = AuthUtils.generateToken({
      userId: user.id.toString(),
      email: user.email,
      role: user.role,
      firstName:user.first_name,
      lastName:user.last_name,
      phoneNumber:user.phone_number
    });

    res.json({
      message: 'Token refreshed successfully',
      token: newToken
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({
      error: 'Token refresh failed',
      message: 'An error occurred while refreshing token'
    });
  }
}; 