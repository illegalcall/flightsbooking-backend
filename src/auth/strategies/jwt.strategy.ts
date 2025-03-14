import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { Env } from '../../config/env.schema';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService<Env>,
    private supabaseService: SupabaseService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    try {
      // Verify the token with Supabase
      const token = ExtractJwt.fromAuthHeaderAsBearerToken()({
        headers: { authorization: `Bearer ${payload.sub}` },
      } as any);

      if (!token) {
        throw new UnauthorizedException('Invalid token');
      }

      const user = await this.supabaseService.verifyToken(token);

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      return {
        userId: user.id,
        email: user.email,
        role: user.user_metadata?.role || 'user',
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
