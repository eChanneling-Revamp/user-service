import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleStrategy } from './strategies/google.strategy';
import { AzureStrategy } from './strategies/azure.strategy';

const strategyProviders = [] as any[];
if (
  process.env.GOOGLE_CLIENT_ID &&
  process.env.GOOGLE_CLIENT_SECRET &&
  process.env.GOOGLE_REDIRECT_URI
) {
  strategyProviders.push(GoogleStrategy);
}

if (
  process.env.AZURE_CLIENT_ID &&
  process.env.AZURE_CLIENT_SECRET &&
  process.env.AZURE_REDIRECT_URI
) {
  strategyProviders.push(AzureStrategy);
}

@Module({
  controllers: [AuthController],
  providers: [AuthService, ...strategyProviders],
})
export class AuthModule {}
