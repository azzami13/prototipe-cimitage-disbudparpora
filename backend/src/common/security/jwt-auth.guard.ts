import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Request } from 'express';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { UserRole } from '../enums/user-role.enum';
import { AuthenticatedUser } from './authenticated-user';
import { IS_PUBLIC_KEY } from './public.decorator';

type AuthenticatedRequest = Request & { user?: AuthenticatedUser };

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.bearerToken(request.headers.authorization);
    if (!token) throw new UnauthorizedException('Token autentikasi diperlukan');

    try {
      const payload = await this.jwtService.verifyAsync(token);
      const userId = Number(payload.sub);
      if (!Number.isInteger(userId) || userId < 1) throw new Error();

      const user = await this.userRepository.findOne({
        where: { id: userId },
        relations: ['role'],
      });
      if (!user || !user.active || user.account_status !== 'normal') {
        throw new Error();
      }

      const databaseRole = (user.role?.name ?? UserRole.CUSTOMER) as UserRole;
      const tokenRole = (payload.role ?? UserRole.CUSTOMER) as UserRole;
      if (
        tokenRole !== databaseRole ||
        !Object.values(UserRole).includes(tokenRole)
      ) {
        throw new Error();
      }

      request.user = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: tokenRole,
      };
      return true;
    } catch {
      throw new UnauthorizedException(
        'Token tidak valid atau sesi sudah berubah',
      );
    }
  }

  private bearerToken(authorization?: string): string | undefined {
    const [scheme, token] = authorization?.split(' ') ?? [];
    return scheme === 'Bearer' && token ? token : undefined;
  }
}
