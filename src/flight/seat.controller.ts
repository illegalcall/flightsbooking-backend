import {
  Controller,
  Get,
  Param,
  Query,
  ValidationPipe,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiOkResponse,
} from '@nestjs/swagger';
import { SeatService } from './seat.service';
import { Seat } from './entities/seat.entity';
import { CabinClass } from '@prisma/client';
import { GetSeatsDto, SeatMapResponseDto } from './dto/seat.dto';

@ApiTags('seats')
@Controller({
  path: 'seats',
  version: '1',
})
export class SeatController {
  private readonly logger = new Logger(SeatController.name);

  constructor(private readonly seatService: SeatService) {}

  @Get('flight/:flightId')
  @ApiOperation({
    summary: 'Get all seats for a flight',
    description:
      'Get detailed information about all seats for a specific flight',
  })
  @ApiParam({
    name: 'flightId',
    description: 'ID of the flight',
    type: 'string',
  })
  @ApiQuery({
    name: 'cabinClass',
    description: 'Filter seats by cabin class',
    enum: CabinClass,
    required: false,
  })
  @ApiOkResponse({
    description: 'List of all seats for the flight',
    type: [Seat],
  })
  async getSeatsForFlight(
    @Param('flightId') flightId: string,
    @Query('cabinClass') cabinClass?: CabinClass,
  ): Promise<Seat[]> {
    this.logger.log(`Getting seats for flight ${flightId}`);
    return this.seatService.getSeatsForFlight(flightId, cabinClass);
  }

  @Get('map/:flightId')
  @ApiOperation({
    summary: 'Get seat map for a flight',
    description:
      'Get a structured seat map organized by cabin class for a specific flight',
  })
  @ApiParam({
    name: 'flightId',
    description: 'ID of the flight',
    type: 'string',
  })
  @ApiOkResponse({
    description: 'Seat map for the flight',
    type: SeatMapResponseDto,
  })
  async getSeatMap(
    @Param('flightId') flightId: string,
  ): Promise<SeatMapResponseDto> {
    this.logger.log(`Getting seat map for flight ${flightId}`);
    return this.seatService.getSeatMap(flightId);
  }
}
