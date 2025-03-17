import { ApiProperty } from '@nestjs/swagger';

export class AdminResponseDto {
  @ApiProperty({
    description: 'Whether the operation was successful',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Message describing the result of the operation',
    example: 'Operation completed successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Data returned by the operation',
    example: {},
    required: false,
  })
  data?: any;

  @ApiProperty({
    description: 'Error details if the operation failed',
    example: null,
    required: false,
  })
  error?: any;
}
