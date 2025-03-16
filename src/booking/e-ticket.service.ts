import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import * as PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';
import { createWriteStream } from 'fs';
import { join } from 'path';
import { promises as fs } from 'fs';
import { BookingStatus } from '@prisma/client';

@Injectable()
export class ETicketService {
  private readonly logger = new Logger(ETicketService.name);
  private tempDir: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    // Create a temporary directory for storing PDFs
    this.tempDir = this.configService.get<string>('TEMP_DIR', '/tmp/e-tickets');
    // Don't call the async method directly in constructor
    // We'll initialize the directory on-demand in generateETicket
  }

  /**
   * Ensures the temporary directory exists
   */
  private async ensureTempDirExists(): Promise<void> {
    if (!this.tempDir) {
      this.tempDir = this.configService.get<string>(
        'TEMP_DIR',
        '/tmp/e-tickets',
      );
    }

    try {
      await fs.access(this.tempDir);
    } catch (error) {
      // Directory doesn't exist, create it
      await fs.mkdir(this.tempDir, { recursive: true });
      this.logger.log(`Created temporary directory at ${this.tempDir}`);
    }
  }

  /**
   * Generates an e-ticket PDF for a booking
   * @param bookingId The ID of the booking
   * @returns Path to the generated PDF file
   */
  async generateETicket(bookingId: string): Promise<string> {
    try {
      // Ensure temp directory exists before proceeding
      await this.ensureTempDirExists();

      // Fetch the booking with all necessary related data
      const booking = await this.prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          userProfile: true,
          flight: {
            include: {
              origin: true,
              destination: true,
            },
          },
          bookedSeats: true,
        },
      });

      if (!booking) {
        throw new NotFoundException(`Booking with ID ${bookingId} not found`);
      }

      // Only confirmed bookings can have e-tickets
      if (booking.status !== BookingStatus.Confirmed) {
        throw new Error(
          `Cannot generate e-ticket for booking in ${booking.status} status`,
        );
      }

      // Generate QR code for this booking
      const qrCodeDataUrl = await this.generateQRCode(booking.bookingReference);

      // Create a PDF file path
      const pdfPath = join(
        this.tempDir,
        `e-ticket-${booking.bookingReference}.pdf`,
      );

      // Generate the PDF
      await this.createPDF(booking, qrCodeDataUrl, pdfPath);

      return pdfPath;
    } catch (error) {
      this.logger.error(
        `Error generating e-ticket: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Generates a QR code for a booking reference
   * @param bookingReference The booking reference code
   * @returns Data URL of the QR code
   */
  private async generateQRCode(bookingReference: string): Promise<string> {
    try {
      // Generate a QR code with the booking reference
      const qrCodeData = `BOOKING:${bookingReference}`;
      return await QRCode.toDataURL(qrCodeData);
    } catch (error) {
      this.logger.error(
        `Error generating QR code: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Creates a PDF e-ticket
   * @param booking The booking data
   * @param qrCodeDataUrl QR code data URL
   * @param outputPath Path to save the PDF
   */
  private async createPDF(
    booking: any,
    qrCodeDataUrl: string,
    outputPath: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 50,
          info: {
            Title: `E-Ticket - ${booking.bookingReference}`,
            Author: 'FlightsBooking System',
          },
        });

        // Pipe output to file
        const stream = doc.pipe(createWriteStream(outputPath));

        // Add a title
        doc
          .font('Helvetica-Bold')
          .fontSize(24)
          .text('E-TICKET', { align: 'center' });

        doc.moveDown();

        // Add booking reference
        doc
          .font('Helvetica-Bold')
          .fontSize(14)
          .text('Booking Reference:')
          .font('Helvetica')
          .text(booking.bookingReference)
          .moveDown();

        // Flight information
        doc
          .font('Helvetica-Bold')
          .fontSize(16)
          .text('Flight Information')
          .moveDown(0.5);

        doc
          .font('Helvetica-Bold')
          .fontSize(12)
          .text(
            `Flight: ${booking.flight.airline} ${booking.flight.flightNumber}`,
          )
          .moveDown(0.5);

        // Format dates
        const departureDate = new Date(booking.flight.departureTime);
        const arrivalDate = new Date(booking.flight.arrivalTime);

        const formatDate = (date: Date) => {
          return date.toLocaleString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });
        };

        doc
          .font('Helvetica')
          .text(
            `From: ${booking.flight.origin.name} (${booking.flight.origin.code})`,
          )
          .text(
            `To: ${booking.flight.destination.name} (${booking.flight.destination.code})`,
          )
          .text(`Departure: ${formatDate(departureDate)}`)
          .text(`Arrival: ${formatDate(arrivalDate)}`)
          .text(`Cabin Class: ${booking.selectedCabin}`)
          .moveDown(0.5);

        // Passenger information
        doc.font('Helvetica-Bold').fontSize(16).text('Passenger Information');
        doc.moveDown(0.5);

        const passengerDetails = booking.passengerDetails as any[];

        passengerDetails.forEach((passenger, index) => {
          doc
            .font('Helvetica-Bold')
            .fontSize(12)
            .text(`Passenger ${index + 1}: ${passenger.fullName}`)
            .font('Helvetica')
            .text(`Document Number: ${passenger.documentNumber}`)
            .moveDown(0.5);
        });

        // Seat information
        doc.font('Helvetica-Bold').fontSize(16).text('Seat Information');
        doc.moveDown(0.5);

        const seatNumbers = booking.bookedSeats.map(
          (seat: any) => seat.seatNumber,
        );
        doc
          .font('Helvetica')
          .text(`Seats: ${seatNumbers.join(', ')}`)
          .moveDown();

        // Add QR code image
        doc.image(qrCodeDataUrl, {
          fit: [150, 150],
          align: 'center',
        });

        doc.moveDown();
        doc
          .font('Helvetica')
          .fontSize(10)
          .text(
            'Please scan this QR code at the airport check-in counter or self-service kiosk.',
            { align: 'center' },
          );

        // Add footer
        const bottomOfPage = doc.page.height - 100;
        doc
          .fontSize(10)
          .text(
            'This is an electronic ticket. Please present this along with a valid photo ID at the airport.',
            50,
            bottomOfPage,
            { width: 500, align: 'center' },
          );

        // Finalize the PDF
        doc.end();

        // Handle stream events
        stream.on('finish', () => {
          this.logger.log(`E-ticket PDF created at ${outputPath}`);
          resolve();
        });

        stream.on('error', (error) => {
          this.logger.error(`Error creating PDF: ${error.message}`);
          reject(error);
        });
      } catch (error) {
        this.logger.error(`Error creating PDF: ${error.message}`, error.stack);
        reject(error);
      }
    });
  }
}
