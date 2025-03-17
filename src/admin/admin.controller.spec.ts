import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from './guards/admin.guard';
import { UserListResponseDto } from './dto/user-management.dto';
import { BookingListResponseDto } from './dto/booking-management.dto';
import { FlightListResponseDto } from './dto/flight-management.dto';
import { AdminResponseDto } from './dto/admin-response.dto';

describe('AdminController', () => {
  let controller: AdminController;
  let adminService: AdminService;

  // Create a mock AdminService with all the methods the controller uses
  const mockAdminService = {
    listUsers: jest.fn().mockResolvedValue({
      success: true,
      data: [],
      total: 0,
      page: 1,
      limit: 10,
    } as UserListResponseDto),
    getUserDetails: jest.fn().mockResolvedValue({
      success: true,
      message: 'User details retrieved',
      data: {},
    } as AdminResponseDto),
    updateUserRole: jest.fn().mockResolvedValue({
      success: true,
      message: 'User role updated',
      data: {},
    } as AdminResponseDto),
    disableUser: jest.fn().mockResolvedValue({
      success: true,
      message: 'User disabled',
      data: {},
    } as AdminResponseDto),
    listBookings: jest.fn().mockResolvedValue({
      success: true,
      data: [],
      total: 0,
      page: 1,
      limit: 10,
    } as BookingListResponseDto),
    getBookingDetails: jest.fn().mockResolvedValue({
      success: true,
      message: 'Booking details retrieved',
      data: {},
    } as AdminResponseDto),
    updateBookingStatus: jest.fn().mockResolvedValue({
      success: true,
      message: 'Booking status updated',
      data: {},
    } as AdminResponseDto),
    listFlights: jest.fn().mockResolvedValue({
      success: true,
      data: [],
      total: 0,
      page: 1,
      limit: 10,
    } as FlightListResponseDto),
    createFlight: jest.fn().mockResolvedValue({
      success: true,
      message: 'Flight created',
      data: {},
    } as AdminResponseDto),
    getFlightDetails: jest.fn().mockResolvedValue({
      success: true,
      message: 'Flight details retrieved',
      data: {},
    } as AdminResponseDto),
    updateFlight: jest.fn().mockResolvedValue({
      success: true,
      message: 'Flight updated',
      data: {},
    } as AdminResponseDto),
  };

  // Mock guards to prevent authentication issues in tests
  const mockJwtAuthGuard = { canActivate: jest.fn().mockReturnValue(true) };
  const mockAdminGuard = { canActivate: jest.fn().mockReturnValue(true) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        {
          provide: AdminService,
          useValue: mockAdminService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .overrideGuard(AdminGuard)
      .useValue(mockAdminGuard)
      .compile();

    controller = module.get<AdminController>(AdminController);
    adminService = module.get<AdminService>(AdminService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('listUsers', () => {
    it('should return a list of users', async () => {
      const result = await controller.listUsers({});
      expect(result).toEqual({
        success: true,
        data: [],
        total: 0,
        page: 1,
        limit: 10,
      });
      expect(adminService.listUsers).toHaveBeenCalled();
    });
  });

  describe('getUserDetails', () => {
    it('should return user details', async () => {
      const result = await controller.getUserDetails('user-id');
      expect(result).toEqual({
        success: true,
        message: 'User details retrieved',
        data: {},
      });
      expect(adminService.getUserDetails).toHaveBeenCalledWith('user-id');
    });
  });
});
