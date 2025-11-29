const AuthService = require('../../domain/services/authService');
const UserRepository = require('../../domain/repositories/userRepository');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Mock dependencies
jest.mock('../../domain/repositories/userRepository');
jest.mock('bcryptjs');
jest.mock('jsonwebtoken');
jest.mock('axios'); // Mock axios for HIBP check if needed, though we might mock isPasswordPwned directly

describe('AuthService', () => {
    let authService;
    let mockUserRepository;

    beforeEach(() => {
        // Clear all mocks before each test
        jest.clearAllMocks();
        authService = new AuthService();
        mockUserRepository = UserRepository.mock.instances[0];

        // Mock isPasswordPwned to always return false by default to avoid external calls
        authService.isPasswordPwned = jest.fn().mockResolvedValue(false);
    });

    describe('login', () => {
        it('should return token and user when credentials are valid', async () => {
            const email = 'test@example.com';
            const password = 'Password123!';
            const user = {
                id: 1,
                email,
                passwordHash: 'hashedPassword',
                name: 'Test User',
                role: 'student'
            };

            // Setup mocks
            UserRepository.mockImplementation(() => ({
                findByEmail: jest.fn().mockResolvedValue(user)
            }));
            // Re-instantiate to apply mock
            authService = new AuthService();

            bcrypt.compare.mockResolvedValue(true);
            jwt.sign.mockReturnValue('fake-token');

            const result = await authService.login(email, password);

            expect(result).toHaveProperty('token', 'fake-token');
            expect(result.user).toEqual({
                id: user.id,
                role: user.role,
                name: user.name,
                email: user.email
            });
        });

        it('should throw error when user not found', async () => {
            UserRepository.mockImplementation(() => ({
                findByEmail: jest.fn().mockResolvedValue(null)
            }));
            authService = new AuthService();

            await expect(authService.login('wrong@example.com', 'pass'))
                .rejects.toThrow('Credenciales inválidas');
        });

        it('should throw error when password does not match', async () => {
            const user = { email: 'test@example.com', passwordHash: 'hashed' };
            UserRepository.mockImplementation(() => ({
                findByEmail: jest.fn().mockResolvedValue(user)
            }));
            authService = new AuthService();
            bcrypt.compare.mockResolvedValue(false);

            await expect(authService.login('test@example.com', 'wrongpass'))
                .rejects.toThrow('Credenciales inválidas');
        });
    });

    describe('validatePasswordComplexity', () => {
        it('should throw error for short password', () => {
            expect(() => authService.validatePasswordComplexity('Short1!'))
                .toThrow('debe tener al menos 8 caracteres');
        });

        it('should throw error for password without numbers', () => {
            expect(() => authService.validatePasswordComplexity('NoNumbers!'))
                .toThrow('debe contener al menos un número');
        });

        it('should not throw for valid password', () => {
            expect(() => authService.validatePasswordComplexity('Valid123!'))
                .not.toThrow();
        });
    });
});
