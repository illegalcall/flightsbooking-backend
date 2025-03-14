import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ValidationPipe,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FlightService } from './flight.service';
import { SearchFlightDto } from './dto/search-flight.dto';
import { Flight } from '@prisma/client';

@ApiTags('flights')
@Controller({
  path: 'flights',
  version: '1',
})
export class FlightController {
  private readonly logger = new Logger(FlightController.name);

  constructor(private readonly flightService: FlightService) {}

  @Post('search')
  @ApiOperation({ summary: 'Search for available flights' })
  @ApiResponse({
    status: 200,
    description: 'Returns a list of flights matching search criteria',
  })
  async searchFlights(
    @Body(ValidationPipe) searchFlightDto: SearchFlightDto,
  ): Promise<Flight[]> {
    this.logger.log(
      `Searching flights with criteria: ${JSON.stringify(searchFlightDto)}`,
    );
    return this.flightService.search(searchFlightDto);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a flight by ID' })
  @ApiParam({ name: 'id', description: 'Flight ID' })
  @ApiResponse({
    status: 200,
    description: 'Returns the flight with the specified ID',
  })
  @ApiResponse({ status: 404, description: 'Flight not found' })
  async getFlight(@Param('id') id: string): Promise<Flight> {
    return this.flightService.findOne(id);
  }
}
