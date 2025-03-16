import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { Flight, FlightStatus } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { NotificationService } from '../booking/notification.service';

@Injectable()
export class FlightStatusService {
  private readonly logger = new Logger(FlightStatusService.name);
  private readonly processingRetries: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly notificationService: NotificationService,
  ) {
    // Get configuration for retry attempts or use default (3 retries)
    this.processingRetries = this.configService.get<number>(
      'FLIGHT_STATUS_UPDATE_RETRIES',
      3,
    );
    this.logger.log(
      `Flight status update service initialized with ${this.processingRetries} retries`,
    );
  }

  /**
   * Runs every 2 minutes to update flight statuses
   */
  @Cron('*/2 * * * *') // Every 2 minutes
  async updateFlightStatuses() {
    this.logger.log('Running flight status update job');

    try {
      // Get current time for comparison
      const now = new Date();

      // Fetch all flights that need status updates
      const flights = await this.fetchFlightsForStatusUpdate();

      if (flights.length === 0) {
        this.logger.log('No flights found requiring status updates');
        return;
      }

      this.logger.log(`Found ${flights.length} flights to update`);

      let updatedCount = 0;
      let failedCount = 0;

      // Process each flight and update its status
      for (const flight of flights) {
        try {
          const newStatus = this.determineFlightStatus(flight, now);

          // Only update if status has changed
          if (newStatus !== flight.status) {
            const updatedFlight = await this.updateFlightStatus(
              flight.id,
              newStatus,
            );

            // Emit notification for the status change
            this.emitStatusChangeNotification(updatedFlight);

            updatedCount++;
            this.logger.log(
              `Updated flight ${flight.flightNumber} status from ${flight.status} to ${newStatus}`,
            );
          }
        } catch (error) {
          this.logger.error(
            `Failed to update flight ${flight.flightNumber}: ${error.message}`,
            error.stack,
          );
          failedCount++;
        }
      }

      this.logger.log(
        `Flight status update completed: ${updatedCount} updated, ${failedCount} failed`,
      );
    } catch (error) {
      this.logger.error(
        `Error processing flight status updates: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Retrieves flights that need status evaluation
   * @returns Array of flights for processing
   */
  private async fetchFlightsForStatusUpdate(): Promise<Flight[]> {
    try {
      const now = new Date();
      // Get flights for today and tomorrow to ensure we cover all timezones
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(23, 59, 59, 999);

      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      return await this.prisma.flight.findMany({
        where: {
          // Only consider flights within yesterday to tomorrow window
          departureTime: {
            gte: yesterday,
            lte: tomorrow,
          },
          // Exclude cancelled flights
          status: {
            not: FlightStatus.Cancelled,
          },
        },
        include: {
          origin: true,
          destination: true,
        },
      });
    } catch (error) {
      this.logger.error(
        `Error fetching flights for status update: ${error.message}`,
        error.stack,
      );
      return [];
    }
  }

  /**
   * Determines the appropriate flight status based on current time
   * @param flight Flight to evaluate
   * @param currentTime Current time for comparison
   * @returns The determined flight status
   */
  private determineFlightStatus(
    flight: Flight,
    currentTime: Date,
  ): FlightStatus {
    // Convert times to milliseconds for comparison
    const now = currentTime.getTime();
    const departure = new Date(flight.departureTime).getTime();
    const arrival = new Date(flight.arrivalTime).getTime();

    // Calculate time differences in minutes
    const minutesToDeparture = Math.floor((departure - now) / (1000 * 60));
    const minutesSinceDeparture = Math.floor((now - departure) / (1000 * 60));
    const minutesToArrival = Math.floor((arrival - now) / (1000 * 60));

    // Flight has already arrived
    if (now > arrival) {
      return FlightStatus.Landed;
    }

    // Flight is in the air
    if (now > departure && now < arrival) {
      return FlightStatus.InAir;
    }

    // Boarding time (typically 30-60 minutes before departure)
    if (minutesToDeparture <= 60 && minutesToDeparture > 0) {
      return FlightStatus.Boarding;
    }

    // Delayed status - simulate random delays for 10% of flights about to depart
    if (minutesToDeparture <= 120 && Math.random() < 0.1) {
      return FlightStatus.Delayed;
    }

    // Default status for future flights
    return FlightStatus.Scheduled;
  }

  /**
   * Updates a flight's status in the database
   * @param flightId The flight ID to update
   * @param newStatus The new status value
   * @returns The updated flight
   */
  private async updateFlightStatus(
    flightId: string,
    newStatus: FlightStatus,
  ): Promise<Flight> {
    try {
      return await this.prisma.flight.update({
        where: { id: flightId },
        data: {
          status: newStatus,
          updatedAt: new Date(),
        },
        include: {
          origin: true,
          destination: true,
        },
      });
    } catch (error) {
      this.logger.error(
        `Error updating flight ${flightId} status to ${newStatus}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Emits a notification for a flight status change
   * @param flight The updated flight
   */
  private emitStatusChangeNotification(flight: Flight): void {
    try {
      // Create a notification event for this flight status change
      // This would be picked up by the SSE endpoints
      // Implementation depends on notification system structure

      // Find bookings affected by this flight
      this.notifyAffectedBookings(flight);

      // Log the notification
      this.logger.log(
        `Emitted status change notification for flight ${flight.flightNumber}`,
      );
    } catch (error) {
      this.logger.error(
        `Error emitting status change notification: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Notifies users with bookings on the affected flight
   * @param flight The updated flight
   */
  private async notifyAffectedBookings(flight: Flight): Promise<void> {
    try {
      // Find bookings for this flight that are not cancelled
      const bookings = await this.prisma.booking.findMany({
        where: {
          flightId: flight.id,
          status: { not: 'Cancelled' },
        },
        include: {
          userProfile: true,
        },
      });

      // No bookings to notify
      if (bookings.length === 0) {
        return;
      }

      this.logger.log(
        `Notifying ${bookings.length} bookings about flight ${flight.flightNumber} status change to ${flight.status}`,
      );

      // Send notifications to each booking owner
      for (const booking of bookings) {
        if (booking.userProfile) {
          await this.notificationService.sendBookingStatusNotification(
            booking.userProfile.userId,
            booking.id,
            booking.bookingReference,
            booking.status,
            booking.userProfile.email,
            booking.userProfile.fullName,
            `Flight ${flight.flightNumber} status updated to ${flight.status}`,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Error notifying affected bookings: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Manually trigger flight status updates (for testing or admin use)
   */
  async manuallyUpdateFlightStatuses(): Promise<{ message: string }> {
    await this.updateFlightStatuses();
    return { message: 'Flight status update job executed' };
  }
}
