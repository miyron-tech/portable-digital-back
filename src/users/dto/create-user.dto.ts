import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail({}, { message: 'Invalid email address' })
  email!: string;

  // Имя и фамилия: без фамилии платёжный провайдер отклоняет оплату.
  @IsString()
  @MinLength(2, { message: 'Name must be at least 2 characters long' })
  @MaxLength(60)
  @Matches(/^\s*\S+\s+\S+/, { message: 'Enter both your first and last name' })
  name!: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(128)
  password!: string;
}
