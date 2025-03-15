import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as fs from 'fs';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    // Set up the nodemailer transporter
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('EMAIL_HOST', 'smtp.example.com'),
      port: this.configService.get<number>('EMAIL_PORT', 587),
      secure: this.configService.get<boolean>('EMAIL_SECURE', false),
      auth: {
        user: this.configService.get<string>('EMAIL_USER', ''),
        pass: this.configService.get<string>('EMAIL_PASSWORD', ''),
      },
    });

    // Verify the connection configuration
    this.verifyConnection();
  }

  /**
   * Verifies the email service connection
   */
  private async verifyConnection(): Promise<void> {
    if (
      this.configService.get<string>('NODE_ENV') === 'production' ||
      this.configService.get<boolean>('VERIFY_EMAIL_CONNECTION', false)
    ) {
      try {
        await this.transporter.verify();
        this.logger.log('Email service connection verified');
      } catch (error) {
        this.logger.warn(
          `Email service connection failed: ${error.message}. Emails will not be sent.`,
        );
      }
    }
  }

  /**
   * Sends an e-ticket email
   * @param to Recipient email address
   * @param bookingReference Booking reference code
   * @param pdfPath Path to the e-ticket PDF
   * @param passengerName Name of the main passenger
   * @returns Success indicator
   */
  async sendETicket(
    to: string,
    bookingReference: string,
    pdfPath: string,
    passengerName: string,
  ): Promise<boolean> {
    try {
      // Prepare the email
      const mailOptions: nodemailer.SendMailOptions = {
        from: this.configService.get<string>(
          'EMAIL_FROM',
          'bookings@flights-booking.com',
        ),
        to,
        subject: `Your E-Ticket - ${bookingReference}`,
        text: `
Dear ${passengerName},

Thank you for booking with Flights Booking!

Your booking has been confirmed, and your e-ticket is attached to this email.
Please keep this e-ticket for your records and present it at the airport check-in counter.

Booking Reference: ${bookingReference}

Safe travels!

Flights Booking Team
        `,
        html: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #4a6da7;">Your E-Ticket is Ready</h2>
  
  <p>Dear ${passengerName},</p>
  
  <p>Thank you for booking with Flights Booking!</p>
  
  <p>Your booking has been confirmed, and your e-ticket is attached to this email.
  Please keep this e-ticket for your records and present it at the airport check-in counter.</p>
  
  <div style="background-color: #f8f9fa; border-left: 4px solid #4a6da7; padding: 15px; margin: 20px 0;">
    <p style="margin: 0;"><strong>Booking Reference:</strong> ${bookingReference}</p>
  </div>
  
  <p>Safe travels!</p>
  
  <p>Flights Booking Team</p>
  
  <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666;">
    <p>This is an automated email. Please do not reply to this message.</p>
  </div>
</div>
        `,
        attachments: [
          {
            filename: `e-ticket-${bookingReference}.pdf`,
            content: fs.createReadStream(pdfPath),
            contentType: 'application/pdf',
          },
        ],
      };

      // If we're not in production, log the email instead of sending it
      if (this.configService.get<string>('NODE_ENV') !== 'production') {
        this.logger.log(
          `[DEV MODE] Email would be sent to ${to} with subject: ${mailOptions.subject}`,
        );
        return true;
      }

      // Send the email
      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(`Email sent: ${info.messageId}`);
      return true;
    } catch (error) {
      this.logger.error(`Error sending email: ${error.message}`, error.stack);
      return false;
    }
  }
}
