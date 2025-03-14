import { Test, TestingModule } from '@nestjs/testing';
import { SupabaseService } from './supabase.service';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn(),
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
      refreshSession: jest.fn(),
    },
  })),
}));

describe('SupabaseService', () => {
  let service: SupabaseService;
  let configService: ConfigService;
  let supabaseClient: any;

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn((key) => {
        if (key === 'SUPABASE_URL') return 'https://example.supabase.co';
        if (key === 'SUPABASE_KEY') return 'mock-key';
        return null;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupabaseService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<SupabaseService>(SupabaseService);
    configService = module.get<ConfigService>(ConfigService);

    // Access the private supabase client for testing
    supabaseClient = (service as any).supabase;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('initialization', () => {
    it('should throw an error if Supabase credentials are missing', async () => {
      const mockConfigService = {
        get: jest.fn().mockReturnValue(null),
      } as unknown as ConfigService;

      expect(() => {
        new SupabaseService(mockConfigService);
      }).toThrow('Supabase credentials not found in environment variables');
    });
  });

  describe('verifyToken', () => {
    it('should return user data for a valid token', async () => {
      const mockUser = { id: 'user-id', email: 'test@example.com' };
      supabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const result = await service.verifyToken('valid-token');
      expect(result).toEqual(mockUser);
      expect(supabaseClient.auth.getUser).toHaveBeenCalledWith('valid-token');
    });

    it('should throw UnauthorizedException if token verification fails', async () => {
      supabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid token' },
      });

      await expect(service.verifyToken('invalid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('signUp', () => {
    it('should sign up a user successfully', async () => {
      const mockData = {
        user: { id: 'user-id', email: 'test@example.com' },
        session: { access_token: 'token' },
      };
      supabaseClient.auth.signUp.mockResolvedValue({
        data: mockData,
        error: null,
      });

      const result = await service.signUp('test@example.com', 'password');
      expect(result).toEqual(mockData);
      expect(supabaseClient.auth.signUp).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password',
      });
    });

    it('should throw an error if signup fails', async () => {
      supabaseClient.auth.signUp.mockResolvedValue({
        data: null,
        error: { message: 'Email already in use' },
      });

      await expect(
        service.signUp('test@example.com', 'password'),
      ).rejects.toThrow('Email already in use');
    });
  });

  describe('signIn', () => {
    it('should sign in a user successfully', async () => {
      const mockData = {
        user: { id: 'user-id', email: 'test@example.com' },
        session: { access_token: 'token' },
      };
      supabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: mockData,
        error: null,
      });

      const result = await service.signIn('test@example.com', 'password');
      expect(result).toEqual(mockData);
      expect(supabaseClient.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password',
      });
    });

    it('should throw an error if signin fails', async () => {
      supabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: null,
        error: { message: 'Invalid login credentials' },
      });

      await expect(
        service.signIn('test@example.com', 'password'),
      ).rejects.toThrow('Invalid login credentials');
    });
  });

  describe('signOut', () => {
    it('should sign out a user successfully', async () => {
      supabaseClient.auth.signOut.mockResolvedValue({
        error: null,
      });

      const result = await service.signOut('token');
      expect(result).toBe(true);
      expect(supabaseClient.auth.signOut).toHaveBeenCalledWith({
        scope: 'global',
      });
    });

    it('should throw an error if signout fails', async () => {
      supabaseClient.auth.signOut.mockResolvedValue({
        error: { message: 'Error signing out' },
      });

      await expect(service.signOut('token')).rejects.toThrow(
        'Error signing out',
      );
    });
  });

  describe('refreshSession', () => {
    it('should refresh a session successfully', async () => {
      const mockData = {
        session: { access_token: 'new-token' },
      };
      supabaseClient.auth.refreshSession.mockResolvedValue({
        data: mockData,
        error: null,
      });

      const result = await service.refreshSession('refresh-token');
      expect(result).toEqual(mockData);
      expect(supabaseClient.auth.refreshSession).toHaveBeenCalledWith({
        refresh_token: 'refresh-token',
      });
    });

    it('should throw an error if session refresh fails', async () => {
      supabaseClient.auth.refreshSession.mockResolvedValue({
        data: null,
        error: { message: 'Invalid refresh token' },
      });

      await expect(service.refreshSession('invalid-token')).rejects.toThrow(
        'Invalid refresh token',
      );
    });
  });
});
