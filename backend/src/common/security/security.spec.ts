import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Public } from './public.decorator';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';
import { UserRole } from '../enums/user-role.enum';

class TestController {
  @Public()
  publicEndpoint() {}

  privateEndpoint() {}

  @Roles(UserRole.SUPER_ADMIN)
  adminEndpoint() {}
}

function contextFor(
  handler: (...args: any[]) => any,
  request: any = { headers: {} },
): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => TestController,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('global security guards', () => {
  const reflector = new Reflector();
  const jwtService = { verifyAsync: jest.fn() };
  const userRepository = { findOne: jest.fn() };
  const authGuard = new JwtAuthGuard(
    reflector,
    jwtService as any,
    userRepository as any,
  );
  const rolesGuard = new RolesGuard(reflector);

  beforeEach(() => jest.clearAllMocks());

  it('allows an explicitly public endpoint without a token', async () => {
    await expect(
      authGuard.canActivate(
        contextFor(TestController.prototype.publicEndpoint),
      ),
    ).resolves.toBe(true);
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it('returns 401 for a private endpoint without a token', async () => {
    await expect(
      authGuard.canActivate(
        contextFor(TestController.prototype.privateEndpoint),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('returns 403 when a customer opens a super-admin endpoint', () => {
    const context = contextFor(TestController.prototype.adminEndpoint, {
      user: { id: 1, role: UserRole.CUSTOMER },
    });
    expect(() => rolesGuard.canActivate(context)).toThrow(ForbiddenException);
  });
});
