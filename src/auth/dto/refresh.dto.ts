import { IsJWT } from 'class-validator';

export class RefreshDto {
  @IsJWT({ message: 'Invalid refresh token' })
  refreshToken!: string;
}
