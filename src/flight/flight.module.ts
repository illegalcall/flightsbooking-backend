import { Module } from '@nestjs/common';
import { FlightController } from './flight.controller';
import { FlightService } from './flight.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CacheModule } from '@nestjs/cache-manager';
import { BookingModule } from '../booking/booking.module';
import { FlightStatusService } from './flight-status.service';
import { FlightStatusController } from './flight-status.controller';

@Module({
  imports: [PrismaModule, CacheModule.register(), BookingModule],
  controllers: [FlightController, FlightStatusController],
  providers: [FlightService, FlightStatusService],
  exports: [FlightService, FlightStatusService],
})
export class FlightModule {}
