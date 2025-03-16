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
  ApiOkResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FlightService } from './flight.service';
import {
  SearchFlightDto,
  PaginatedFlightResponseDto,
} from './dto/search-flight.dto';
import { Flight } from './entities/flight.entity';

@ApiTags('flights')
@Controller({
  path: 'flights',
  version: '1',
})
export class FlightController {
  private readonly logger = new Logger(FlightController.name);

  constructor(private readonly flightService: FlightService) {}

  @Post('search')
  @ApiOperation({
    summary: 'Search for available flights',
    description:
      'Search for flights with pagination, filtering, and dynamic pricing',
  })
  @ApiOkResponse({
    description: 'Returns a paginated list of flights matching search criteria',
    type: PaginatedFlightResponseDto,
    schema: {
      allOf: [
        { $ref: getSchemaPath(PaginatedFlightResponseDto) },
        {
          properties: {
            data: {
              type: 'array',
              items: {
                allOf: [
                  { $ref: getSchemaPath(Flight) },
                  {
                    type: 'object',
                    properties: {
                      calculatedPrice: {
                        type: 'number',
                        description:
                          'Dynamically calculated price based on availability',
                      },
                    },
                  },
                ],
              },
            },
          },
        },
      ],
    },
  })
  async searchFlights(
    @Body(ValidationPipe) searchFlightDto: SearchFlightDto,
  ): Promise<PaginatedFlightResponseDto> {
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
  @ApiOkResponse({
    description: 'Returns the flight with the specified ID',
    type: Flight,
  })
  @ApiResponse({ status: 404, description: 'Flight not found' })
  async getFlight(@Param('id') id: string): Promise<Flight> {
    this.logger.log('Getting flight with ID: ' + id);
    const flight = await this.flightService.findOne(id);
    this.logger.log(`Successfully retrieved flight with ID: ${id}`);
    return flight;
  }
}
