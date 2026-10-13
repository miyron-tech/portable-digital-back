import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { UsersService } from '../users/users.service';
import type { UserDocument } from '../users/schemas/user.schema';
import type { AuthTokens, JwtPayload } from './auth.types';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.users.findByEmail(dto.email);
    if (existing) throw new ConflictException('A user with this email is already registered');

    const passwordHash = await argon2.hash(dto.password);
    const user = await this.users.create({
      email: dto.email,
      name: dto.name,
      passwordHash,
    });

    return this.issueSession(user);
  }

  async login(dto: LoginDto) {
    const user = await this.users.findByEmail(dto.email, true);
    // Same message for both branches so the endpoint does not confirm which
    // emails exist.
    if (!user) throw new UnauthorizedException('Invalid email or password');

    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) throw new UnauthorizedException('Invalid email or password');

    return this.issueSession(user);
  }

  async refresh(userId: string, presentedToken: string) {
    const user = await this.users.findById(userId, true);
    if (!user?.refreshTokenHash) throw new UnauthorizedException('Session is no longer valid');

    const matches = await argon2.verify(user.refreshTokenHash, presentedToken);
    if (!matches) {
      // Token reuse or a stale token — drop the session entirely.
      await this.users.setRefreshTokenHash(userId, null);
      throw new UnauthorizedException('Session is no longer valid');
    }

    return this.issueSession(user);
  }

  async logout(userId: string) {
    await this.users.revokeSessions(userId);
    return { success: true };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.users.findById(userId, true);
    if (!user || !await argon2.verify(user.passwordHash, dto.currentPassword)) {
      throw new BadRequestException('The current password is incorrect.');
    }
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('Choose a different password.');
    }
    const changed = await this.users.replacePassword(userId, user.passwordHash, await argon2.hash(dto.newPassword));
    if (!changed) throw new ConflictException('Your account changed. Please sign in and try again.');
    return { success: true };
  }

  async profile(userId: string) {
    const user = await this.users.findByIdOrFail(userId);
    return user.toJSON();
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.users.findByIdOrFail(userId);
    if (dto.firstName !== undefined && dto.lastName !== undefined) {
      user.name = `${dto.firstName.trim()} ${dto.lastName.trim()}`;
    }
    if (dto.billingAddress) {
      user.billingAddress = {
        addressLine1: dto.billingAddress.addressLine1.trim(),
        city: dto.billingAddress.city.trim(),
        postalCode: dto.billingAddress.postalCode.trim(),
        countryCode: dto.billingAddress.countryCode.trim().toUpperCase(),
      };
    }
    await user.save();
    return user.toJSON();
  }

  private async issueSession(user: UserDocument) {
    const tokens = await this.signTokens({
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
      sessionVersion: user.sessionVersion ?? 0,
    });
    await this.users.setRefreshTokenHash(
      user._id.toString(),
      await argon2.hash(tokens.refreshToken),
    );
    return { user: user.toJSON(), ...tokens };
  }

  private async signTokens(payload: JwtPayload): Promise<AuthTokens> {
    // TTLs arrive as plain strings from config; jsonwebtoken types them as a
    // template-literal union, so the cast is unavoidable here.
    const accessTtl = this.config.getOrThrow<string>('jwt.accessTtl');
    const refreshTtl = this.config.getOrThrow<string>('jwt.refreshTtl');
    type ExpiresIn = JwtSignOptions['expiresIn'];
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.getOrThrow<string>('jwt.accessSecret'),
        expiresIn: accessTtl as ExpiresIn,
      }),
      this.jwt.signAsync(payload, {
        secret: this.config.getOrThrow<string>('jwt.refreshSecret'),
        expiresIn: refreshTtl as ExpiresIn,
      }),
    ]);
    return { accessToken, refreshToken, expiresIn: ttlToSeconds(accessTtl) };
  }
}

/** Converts a jsonwebtoken-style TTL ("15m", "7d", "3600") into seconds. */
function ttlToSeconds(ttl: string): number {
  const match = /^(\d+)\s*([smhd])?$/.exec(ttl.trim());
  if (!match) return 900;
  const value = parseInt(match[1], 10);
  const unit = match[2] ?? 's';
  const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  return value * multipliers[unit];
}
