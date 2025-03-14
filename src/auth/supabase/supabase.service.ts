import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Env } from '../../config/env.schema';

@Injectable()
export class SupabaseService {
  private supabase: SupabaseClient;
  private readonly logger = new Logger(SupabaseService.name);

  constructor(private configService: ConfigService<Env>) {
    const supabaseUrl = this.configService.get('SUPABASE_URL');
    const supabaseKey = this.configService.get('SUPABASE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error(
        'Supabase credentials not found in environment variables',
      );
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.logger.log('Supabase client initialized');
  }

  /**
   * Verify a JWT token from Supabase
   * @param token The JWT token to verify
   * @returns The user data if the token is valid
   */
  async verifyToken(token: string) {
    try {
      const { data, error } = await this.supabase.auth.getUser(token);

      if (error) {
        this.logger.error(`Token verification failed: ${error.message}`);
        throw new UnauthorizedException('Invalid token');
      }

      return data.user;
    } catch (error) {
      this.logger.error(`Token verification error: ${error.message}`);
      throw new UnauthorizedException('Invalid token');
    }
  }

  /**
   * Sign up a new user
   * @param email User's email
   * @param password User's password
   * @returns The user data if signup is successful
   */
  async signUp(email: string, password: string) {
    try {
      const { data, error } = await this.supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        this.logger.error(`Signup failed: ${error.message}`);
        throw new Error(error.message);
      }

      return data;
    } catch (error) {
      this.logger.error(`Signup error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Sign in a user
   * @param email User's email
   * @param password User's password
   * @returns The session data if signin is successful
   */
  async signIn(email: string, password: string) {
    try {
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        this.logger.error(`Signin failed: ${error.message}`);
        throw new Error(error.message);
      }

      return data;
    } catch (error) {
      this.logger.error(`Signin error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Sign out a user
   * @param token The JWT token to invalidate
   */
  async signOut(token: string) {
    try {
      const { error } = await this.supabase.auth.signOut({
        scope: 'global',
      });

      if (error) {
        this.logger.error(`Signout failed: ${error.message}`);
        throw new Error(error.message);
      }

      return true;
    } catch (error) {
      this.logger.error(`Signout error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Refresh a session
   * @param refreshToken The refresh token
   * @returns The new session data
   */
  async refreshSession(refreshToken: string) {
    try {
      const { data, error } = await this.supabase.auth.refreshSession({
        refresh_token: refreshToken,
      });

      if (error) {
        this.logger.error(`Session refresh failed: ${error.message}`);
        throw new Error(error.message);
      }

      return data;
    } catch (error) {
      this.logger.error(`Session refresh error: ${error.message}`);
      throw error;
    }
  }
}
