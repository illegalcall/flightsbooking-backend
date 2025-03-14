import {
  Injectable,
  Logger,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SupabaseService } from './supabase/supabase.service';
import { UserProfileService } from '../user/user-profile.service';
import { CreateUserProfileDto } from '../user/dto/create-user-profile.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private jwtService: JwtService,
    private supabaseService: SupabaseService,
    private userProfileService: UserProfileService,
  ) {}

  /**
   * Register a new user
   * @param email User's email
   * @param password User's password
   * @param userData Additional user data
   * @returns The user data and tokens
   */
  async register(
    email: string,
    password: string,
    userData: Omit<CreateUserProfileDto, 'userId' | 'email'>,
  ) {
    try {
      // Sign up with Supabase
      const authData = await this.supabaseService.signUp(email, password);

      if (!authData.user) {
        throw new ConflictException('Failed to create user account');
      }

      // Create user profile in our database
      const userProfileData: CreateUserProfileDto = {
        userId: authData.user.id,
        email: authData.user.email,
        ...userData,
      };

      const userProfile = await this.userProfileService.create(userProfileData);

      return {
        user: userProfile,
        session: authData.session,
      };
    } catch (error) {
      this.logger.error(`Registration error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Login a user
   * @param email User's email
   * @param password User's password
   * @returns The user data and tokens
   */
  async login(email: string, password: string) {
    try {
      // Sign in with Supabase
      const authData = await this.supabaseService.signIn(email, password);

      if (!authData.user) {
        throw new UnauthorizedException('Invalid credentials');
      }

      // Get user profile from our database
      const userProfile = await this.userProfileService.findByUserId(
        authData.user.id,
      );

      return {
        user: userProfile,
        session: authData.session,
      };
    } catch (error) {
      this.logger.error(`Login error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Logout a user
   * @param token The JWT token
   * @returns Success status
   */
  async logout(token: string) {
    try {
      return await this.supabaseService.signOut(token);
    } catch (error) {
      this.logger.error(`Logout error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Refresh a session
   * @param refreshToken The refresh token
   * @returns The new session data
   */
  async refreshToken(refreshToken: string) {
    try {
      return await this.supabaseService.refreshSession(refreshToken);
    } catch (error) {
      this.logger.error(`Token refresh error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Validate a user from JWT payload
   * @param payload The JWT payload
   * @returns The user data
   */
  async validateUser(payload: any) {
    try {
      return await this.userProfileService.findByUserId(payload.userId);
    } catch (error) {
      this.logger.error(`User validation error: ${error.message}`);
      throw new UnauthorizedException('Invalid user');
    }
  }
}
