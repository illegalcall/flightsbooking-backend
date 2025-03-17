import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from './guards/admin.guard';
import { UserListResponseDto } from './dto/user-management.dto';
import { BookingListResponseDto } from './dto/booking-management.dto';
import { FlightListResponseDto } from './dto/flight-management.dto';
import { AdminResponseDto } from './dto/admin-response.dto';
import { UserRole, BookingStatus, FlightStatus } from '@prisma/client';

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

    // Reset mocks before each test
    jest.clearAllMocks();
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

    it('should pass filters to service', async () => {
      const filters = {
        page: 2,
        limit: 5,
        role: UserRole.ADMIN,
        search: 'test',
      };
      await controller.listUsers(filters);
      expect(adminService.listUsers).toHaveBeenCalledWith(filters);
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

  describe('updateUserRole', () => {
    it('should update user role', async () => {
      const updateRoleDto = { role: UserRole.ADMIN };
      const result = await controller.updateUserRole('user-id', updateRoleDto);

      expect(result).toEqual({
        success: true,
        message: 'User role updated',
        data: {},
      });
      expect(adminService.updateUserRole).toHaveBeenCalledWith(
        'user-id',
        updateRoleDto,
      );
    });
  });

  describe('disableUser', () => {
    it('should disable user account', async () => {
      const result = await controller.disableUser('user-id');

      expect(result).toEqual({
        success: true,
        message: 'User disabled',
        data: {},
      });
      expect(adminService.disableUser).toHaveBeenCalledWith('user-id');
    });
  });

  describe('listBookings', () => {
    it('should return a list of bookings', async () => {
      const result = await controller.listBookings({});

      expect(result).toEqual({
        success: true,
        data: [],
        total: 0,
        page: 1,
        limit: 10,
      });
      expect(adminService.listBookings).toHaveBeenCalled();
    });

    it('should pass filters to service', async () => {
      const filters = {
        page: 2,
        limit: 5,
        status: BookingStatus.Confirmed,
        fromDate: '2023-01-01',
        toDate: '2023-12-31',
      };
      await controller.listBookings(filters);
      expect(adminService.listBookings).toHaveBeenCalledWith(filters);
    });
  });

  describe('getBookingDetails', () => {
    it('should return booking details', async () => {
      const result = await controller.getBookingDetails('booking-id');

      expect(result).toEqual({
        success: true,
        message: 'Booking details retrieved',
        data: {},
      });
      expect(adminService.getBookingDetails).toHaveBeenCalledWith('booking-id');
    });
  });

  describe('updateBookingStatus', () => {
    it('should update booking status', async () => {
      const updateStatusDto = {
        status: BookingStatus.Confirmed,
      };
      const result = await controller.updateBookingStatus(
        'booking-id',
        updateStatusDto,
      );

      expect(result).toEqual({
        success: true,
        message: 'Booking status updated',
        data: {},
      });
      expect(adminService.updateBookingStatus).toHaveBeenCalledWith(
        'booking-id',
        updateStatusDto,
      );
    });

    it('should update booking status with reason when cancelled', async () => {
      const updateStatusDto = {
        status: BookingStatus.Cancelled,
        reason: 'Flight cancelled by passenger',
      };

      await controller.updateBookingStatus('booking-id', updateStatusDto);
      expect(adminService.updateBookingStatus).toHaveBeenCalledWith(
        'booking-id',
        updateStatusDto,
      );
    });
  });

  describe('listFlights', () => {
    it('should return a list of flights', async () => {
      const result = await controller.listFlights({});

      expect(result).toEqual({
        success: true,
        data: [],
        total: 0,
        page: 1,
        limit: 10,
      });
      expect(adminService.listFlights).toHaveBeenCalled();
    });

    it('should pass filters to service', async () => {
      const filters = {
        page: 2,
        limit: 5,
        airline: 'Test Airlines',
        status: FlightStatus.Scheduled,
        fromDate: '2023-01-01',
        toDate: '2023-12-31',
      };
      await controller.listFlights(filters);
      expect(adminService.listFlights).toHaveBeenCalledWith(filters);
    });
  });

  describe('createFlight', () => {
    it('should create a new flight', async () => {
      const createFlightDto = {
        flightNumber: 'FL123',
        airline: 'Test Airlines',
        aircraftType: 'Boeing 737',
        departureTime: '2023-01-01T12:00:00Z',
        arrivalTime: '2023-01-01T15:00:00Z',
        duration: 180,
        originId: 'origin1',
        destinationId: 'dest1',
        basePrice: 199.99,
        totalSeats: JSON.stringify({ ECONOMY: 150, BUSINESS: 20, FIRST: 10 }),
      };

      const result = await controller.createFlight(createFlightDto);

      expect(result).toEqual({
        success: true,
        message: 'Flight created',
        data: {},
      });
      expect(adminService.createFlight).toHaveBeenCalledWith(createFlightDto);
    });
  });

  describe('getFlightDetails', () => {
    it('should return flight details', async () => {
      const result = await controller.getFlightDetails('flight-id');

      expect(result).toEqual({
        success: true,
        message: 'Flight details retrieved',
        data: {},
      });
      expect(adminService.getFlightDetails).toHaveBeenCalledWith('flight-id');
    });
  });

  describe('updateFlight', () => {
    it('should update flight details', async () => {
      const updateFlightDto = {
        flightNumber: 'FL123',
        airline: 'Test Airlines',
        aircraftType: 'Boeing 737',
        departureTime: '2023-01-01T13:00:00Z',
        arrivalTime: '2023-01-01T16:00:00Z',
        duration: 180,
        originId: 'origin1',
        destinationId: 'dest1',
        basePrice: 199.99,
        totalSeats: JSON.stringify({ ECONOMY: 150 }),
      };

      const result = await controller.updateFlight(
        'flight-id',
        updateFlightDto,
      );

      expect(result).toEqual({
        success: true,
        message: 'Flight updated',
        data: {},
      });
      expect(adminService.updateFlight).toHaveBeenCalledWith(
        'flight-id',
        updateFlightDto,
      );
    });

    it('should update flight status', async () => {
      const updateFlightDto = {
        flightNumber: 'FL123',
        airline: 'Test Airlines',
        aircraftType: 'Boeing 737',
        departureTime: '2023-01-01T13:00:00Z',
        arrivalTime: '2023-01-01T16:00:00Z',
        duration: 180,
        originId: 'origin1',
        destinationId: 'dest1',
        basePrice: 199.99,
        totalSeats: JSON.stringify({ ECONOMY: 150 }),
        status: FlightStatus.Cancelled,
      };

      await controller.updateFlight('flight-id', updateFlightDto);
      expect(adminService.updateFlight).toHaveBeenCalledWith(
        'flight-id',
        updateFlightDto,
      );
    });
  });
});
