import { Controller, Post } from '@nestjs/common';
import { FlightStatusService } from './flight-status.service';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('flight-status')
@Controller('flight-status')
export class FlightStatusController {
  constructor(private readonly flightStatusService: FlightStatusService) {}

  @Post('update')
  @ApiOperation({ summary: 'Manually trigger flight status updates' })
  @ApiResponse({
    status: 200,
    description: 'Flight status update job executed successfully',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Flight status update job executed',
        },
      },
    },
  })
  async updateFlightStatuses() {
    return this.flightStatusService.manuallyUpdateFlightStatuses();
  }
}
