import type { UserRole } from '../users/schemas/user.schema';

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  sessionVersion?: number;
}

export interface JwtRefreshPayload extends JwtPayload {
  refreshToken: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}
