import { Module } from '@nestjs/common';
import { FlightController } from './flight.controller';
import { FlightService } from './flight.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CacheModule } from '@nestjs/cache-manager';
import { BookingModule } from '../booking/booking.module';
import { FlightStatusService } from './flight-status.service';
import { FlightStatusController } from './flight-status.controller';
import { SeatService } from './seat.service';
import { SeatController } from './seat.controller';

@Module({
  imports: [PrismaModule, CacheModule.register(), BookingModule],
  controllers: [FlightController, FlightStatusController, SeatController],
  providers: [FlightService, FlightStatusService, SeatService],
  exports: [FlightService, FlightStatusService, SeatService],
})
export class FlightModule {}
