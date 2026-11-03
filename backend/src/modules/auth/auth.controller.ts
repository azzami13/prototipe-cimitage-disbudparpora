import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Put,
  Req,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  AuthService,
  GoogleAuthDto,
  LoginDto,
  RegisterDto,
  UpdateProfileDto,
} from './auth.service';
import { Public } from '../../common/security/public.decorator';
import { Throttle } from '@nestjs/throttler';
import { createUploadOptions } from '../../common/upload/upload-options';
import { AuthenticatedUser } from '../../common/security/authenticated-user';
import { StorageService } from '../../common/storage/storage.service';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private readonly storage: StorageService,
  ) {}

  @Post('login')
  @Public()
  @Throttle({ default: { limit: 10, ttl: 15 * 60_000 } })
  async login(@Body() body: LoginDto) {
    const user = await this.authService.validateUser(body.email, body.password);
    if (!user) {
      throw new UnauthorizedException('Email atau password salah');
    }
    return this.authService.login(user);
  }

  @Post('register')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60 * 60_000 } })
  register(@Body() body: RegisterDto) {
    return this.authService.register(body);
  }

  @Post('google')
  @Public()
  @Throttle({ default: { limit: 20, ttl: 15 * 60_000 } })
  google(@Body() body: GoogleAuthDto) {
    return this.authService.loginWithGoogle(body);
  }

  @Get('me')
  me(@Req() req: any) {
    return this.authService.me(req.user.id);
  }

  @Put('profile')
  updateProfile(@Req() req: any, @Body() body: UpdateProfileDto) {
    return this.authService.updateProfile(req.user.id, body);
  }

  @Post('profile/avatar')
  @UseInterceptors(FileInterceptor('file', createUploadOptions('profile')))
  async uploadAvatar(@Req() req: any, @UploadedFile() file: any) {
    if (!file) throw new BadRequestException('Foto profile wajib diunggah');
    const user = await this.authService.me((req.user as AuthenticatedUser).id);
    const stored = await this.storage.fromUploadedFile(req, 'profile', file);
    const updated = await this.authService.updateAvatar(user.id, stored.url);
    await this.storage.deleteIfManaged(user.avatar_url);
    return updated;
  }
}
