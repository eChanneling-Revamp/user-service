import { IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class RefreshTokenDto {
  @ApiProperty({ description: 'Refresh token (accepts either refreshToken or refresh_token). Optional when using cookie-based refresh flow.', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...', required: false })
  @IsOptional()
  @IsString()
  @Transform(({ value, obj }) => value ?? obj?.refresh_token ?? obj?.refreshToken)
  refreshToken?: string;
}
