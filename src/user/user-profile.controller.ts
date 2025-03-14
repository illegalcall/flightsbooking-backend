import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Version,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UserProfileService } from './user-profile.service';
import { CreateUserProfileDto } from './dto/create-user-profile.dto';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
// Assuming we'll create an auth guard later
// import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('user-profiles')
@Controller('user/profile')
export class UserProfileController {
  constructor(private readonly userProfileService: UserProfileService) {}

  @Post()
  @Version('1')
  // @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new user profile' })
  @ApiResponse({
    status: 201,
    description: 'User profile created successfully',
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({
    status: 409,
    description: 'User profile with this email already exists',
  })
  create(@Body() createUserProfileDto: CreateUserProfileDto) {
    return this.userProfileService.create(createUserProfileDto);
  }

  @Get()
  @Version('1')
  // @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'User profile not found' })
  findMyProfile() {
    // We'll implement this once we have auth - for now stub
    // Placeholder: Would get the user ID from the JWT token
    // const userId = req.user.id;
    // return this.userProfileService.findByUserId(userId);
    // For demonstration, return hardcoded ID
    return { message: 'This will return the current user profile' };
  }

  @Get(':id')
  @Version('1')
  // @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a user profile by ID' })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'User profile not found' })
  findOne(@Param('id') id: string) {
    return this.userProfileService.findOne(id);
  }

  @Patch(':id')
  @Version('1')
  // @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a user profile' })
  @ApiResponse({
    status: 200,
    description: 'User profile updated successfully',
  })
  @ApiResponse({ status: 404, description: 'User profile not found' })
  @ApiResponse({ status: 409, description: 'Email address is already in use' })
  update(
    @Param('id') id: string,
    @Body() updateUserProfileDto: UpdateUserProfileDto,
  ) {
    return this.userProfileService.update(id, updateUserProfileDto);
  }

  @Delete(':id')
  @Version('1')
  // @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a user profile' })
  @ApiResponse({
    status: 200,
    description: 'User profile deleted successfully',
  })
  @ApiResponse({ status: 404, description: 'User profile not found' })
  remove(@Param('id') id: string) {
    return this.userProfileService.remove(id);
  }

  @Get(':id/bookings')
  @Version('1')
  // @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user bookings' })
  @ApiResponse({
    status: 200,
    description: 'User bookings retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'User profile not found' })
  getUserBookings(
    @Param('id') id: string,
    @Query('status') status?: 'UPCOMING' | 'PAST' | 'CANCELLED',
  ) {
    return this.userProfileService.getUserBookings(id, { status });
  }
}
