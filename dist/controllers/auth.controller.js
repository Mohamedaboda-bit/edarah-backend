"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.refreshToken = exports.logout = exports.getProfile = exports.login = exports.register = void 0;
const client_1 = require("@prisma/client");
const auth_1 = require("../utils/auth");
const validation_1 = require("../utils/validation");
const prisma = new client_1.PrismaClient();
const register = async (req, res) => {
    try {
        const { firstName, lastName, email, password, phoneNumber } = req.body;
        // Validate input
        const validation = validation_1.ValidationUtils.validateRegistrationInput({
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
        const hashedPassword = await auth_1.AuthUtils.hashPassword(password);
        // Create user
        const newUser = await prisma.users.create({
            data: {
                first_name: firstName.trim(),
                last_name: lastName.trim(),
                email: email.toLowerCase().trim(),
                password: hashedPassword,
                phone_number: phoneNumber.trim(),
                role: client_1.UserRole.client,
                created_at: new Date(),
                updated_at: new Date()
            }
        });
        // Generate JWT token
        const token = auth_1.AuthUtils.generateToken({
            userId: newUser.id.toString(),
            email: newUser.email,
            role: newUser.role,
            firstName: newUser.first_name,
            lastName: newUser.last_name,
            phoneNumber: newUser.phone_number
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
    }
    catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            error: 'Registration failed',
            message: 'An error occurred during registration'
        });
    }
};
exports.register = register;
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        // Validate input
        const validation = validation_1.ValidationUtils.validateLoginInput({ email, password });
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
        const isPasswordValid = await auth_1.AuthUtils.comparePassword(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({
                error: 'Invalid credentials',
                message: 'Email or password is incorrect'
            });
        }
        // Generate JWT token
        const token = auth_1.AuthUtils.generateToken({
            userId: user.id.toString(),
            email: user.email,
            role: user.role,
            firstName: user.first_name,
            lastName: user.last_name,
            phoneNumber: user.phone_number
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
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            error: 'Login failed',
            message: 'An error occurred during login'
        });
    }
};
exports.login = login;
const getProfile = async (req, res) => {
    try {
        const userId = BigInt(req.user.userId);
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
    }
    catch (error) {
        console.error('Profile fetch error:', error);
        res.status(500).json({
            error: 'Profile fetch failed',
            message: 'An error occurred while fetching profile'
        });
    }
};
exports.getProfile = getProfile;
const logout = (req, res) => {
    res.json({
        message: 'Logout successful',
        note: 'Please remove the token from client storage'
    });
};
exports.logout = logout;
const refreshToken = async (req, res) => {
    try {
        const userId = BigInt(req.user.userId);
        // Verify user still exists
        const user = await prisma.users.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                role: true,
                first_name: true,
                last_name: true,
                phone_number: true
            }
        });
        if (!user) {
            return res.status(404).json({
                error: 'User not found',
                message: 'User no longer exists'
            });
        }
        // Generate new token
        const newToken = auth_1.AuthUtils.generateToken({
            userId: user.id.toString(),
            email: user.email,
            role: user.role,
            firstName: user.first_name,
            lastName: user.last_name,
            phoneNumber: user.phone_number
        });
        res.json({
            message: 'Token refreshed successfully',
            token: newToken
        });
    }
    catch (error) {
        console.error('Token refresh error:', error);
        res.status(500).json({
            error: 'Token refresh failed',
            message: 'An error occurred while refreshing token'
        });
    }
};
exports.refreshToken = refreshToken;
//# sourceMappingURL=auth.controller.js.map