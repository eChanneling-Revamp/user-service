import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: this.configService.get<string>('email.user'),
        pass: this.configService.get<string>('email.password'),
      },
    });
  }

  async sendOtpEmail(to: string, otp: string): Promise<boolean> {
    try {
      const mailOptions = {
        from: this.configService.get<string>('email.from'),
        to,
        subject: 'Your OTP Code - eChanneling',
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
              <div style="text-align:center; margin-bottom: 10px;">
                <img src="/assets/echanneling-logo-wide.jpg" alt="eChanneling" style="max-width:100%; height:auto;" />
              </div>
              <h2 style="color: #333;">eChanneling - OTP Verification</h2>
            <p style="font-size: 16px; color: #555;">Your One-Time Password (OTP) is:</p>
            <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #2c3e50; margin: 20px 0;">
              ${otp}
            </div>
            <p style="font-size: 14px; color: #777;">
              This OTP will expire in ${this.configService.get<number>('otp.expiryMinutes')} minutes.
            </p>
            <p style="font-size: 14px; color: #777;">
              If you didn't request this OTP, please ignore this email.
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="font-size: 12px; color: #999;">
              This is an automated email. Please do not reply.
            </p>
          </div>
        `,
      };

      await this.transporter.sendMail(mailOptions);
      this.logger.log(`OTP email sent successfully to ${to}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send OTP email to ${to}: ${error.message}`, error.stack);
      return false;
    }
  }

  async sendWelcomeEmail(to: string, firstName: string): Promise<boolean> {
    try {
      const mailOptions = {
        from: this.configService.get<string>('email.from'),
        to,
        subject: 'Welcome to eChanneling',
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
            <div style="text-align:center; margin-bottom: 10px;">
              <img src="/assets/echanneling-logo.jpg" alt="eChanneling" style="max-width:160px; height:auto;" />
            </div>
            <h2 style="color: #333;">Welcome to eChanneling!</h2>
            <p style="font-size: 16px; color: #555;">Hi ${firstName},</p>
            <p style="font-size: 16px; color: #555;">
              Thank you for registering with eChanneling. Your account has been created successfully.
            </p>
            <p style="font-size: 16px; color: #555;">
              You can now log in and start using our services.
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="font-size: 12px; color: #999;">
              This is an automated email. Please do not reply.
            </p>
          </div>
        `,
      };

      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Welcome email sent successfully to ${to}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send welcome email to ${to}: ${error.message}`, error.stack);
      return false;
    }
  }

  async sendPasswordResetEmail(to: string, otp: string): Promise<boolean> {
    try {
      const mailOptions = {
        from: this.configService.get<string>('email.from'),
        to,
        subject: 'Password Reset Request - eChanneling',
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
            <div style="text-align:center; margin-bottom: 10px;">
              <img src="/assets/echanneling-logo-wide.jpg" alt="eChanneling" style="max-width:100%; height:auto;" />
            </div>
            <h2 style="color: #333;">Password Reset Request</h2>
            <p style="font-size: 16px; color: #555;">
              We received a request to reset your password. Use the OTP code below to complete the password reset:
            </p>
            <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #2c3e50; margin: 20px 0;">
              ${otp}
            </div>
            <p style="font-size: 14px; color: #777;">
              This OTP will expire in ${this.configService.get<number>('otp.expiryMinutes')} minutes.
            </p>
            <p style="font-size: 14px; color: #777;">
              If you didn't request a password reset, please ignore this email and your password will remain unchanged.
            </p>
            <p style="font-size: 14px; color: #d9534f; font-weight: bold;">
              For security reasons, never share this OTP with anyone.
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="font-size: 12px; color: #999;">
              This is an automated email. Please do not reply.
            </p>
          </div>
        `,
      };

      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Password reset email sent successfully to ${to}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send password reset email to ${to}: ${error.message}`, error.stack);
      return false;
    }
  }
}
