import { IsEmail, IsNotEmpty, IsOptional, Length } from 'class-validator';

export class CreateUserDto {
  @IsOptional()
  name?: string;

  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsOptional()
  @Length(8, 128)
  password?: string;

  @IsOptional()
  phone?: string;
}
