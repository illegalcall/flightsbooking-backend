import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRole } from '@prisma/client';

@Injectable()
export class AdminGuard implements CanActivate {
  private readonly logger = new Logger(AdminGuard.name);

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Log the request information for debugging
    this.logger.debug(`Request headers: ${JSON.stringify(request.headers)}`);
    this.logger.debug(`User object: ${JSON.stringify(request.user)}`);

    if (!request.user) {
      this.logger.warn(
        'User not authenticated - user object missing from request',
      );
      throw new UnauthorizedException('User not authenticated');
    }

    try {
      // Extract userId from the user object
      // The JwtStrategy returns { userId, email, role } structure
      const userId = request.user.userId;

      if (!userId) {
        this.logger.warn(
          `User ID not found in token payload: ${JSON.stringify(request.user)}`,
        );
        throw new UnauthorizedException('Invalid user information');
      }

      // First, check if the role from the JWT token is 'admin'
      // This is faster than a database lookup
      if (request.user.role === 'admin') {
        return true;
      }

      // If JWT role check fails, verify against database as backup
      const userProfile = await this.prisma.userProfile.findUnique({
        where: { userId },
        select: { role: true },
      });

      if (!userProfile || userProfile.role !== UserRole.ADMIN) {
        this.logger.warn(
          `User ${userId} attempted to access admin endpoint without admin role`,
        );
        throw new ForbiddenException('User does not have admin privileges');
      }

      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      this.logger.error(
        `Error validating admin privileges: ${error.message}`,
        error.stack,
      );
      throw new UnauthorizedException('Failed to validate admin privileges');
    }
  }
}
