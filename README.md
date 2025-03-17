# Flights Booking API

A modern, robust backend service for flight booking operations built with NestJS and Prisma.

![Flight Booking Banner](https://source.unsplash.com/featured/?airport,flight)

## Features

### User Management
- User registration and authentication via Supabase
- Profile management with personal details and travel preferences
- Role-based access control (User/Admin)

### Flight Management
- Comprehensive flight search with filtering options
- Real-time flight status updates
- Detailed flight information (aircraft, airline, schedule)
- Flight capacity management by cabin class

### Booking System
- Intuitive booking process with passenger details
- Multiple cabin class support (Economy, Premium Economy, Business, First)
- Seat selection with real-time availability
- Temporary seat locking to prevent double bookings
- Booking expiration for incomplete transactions

### Payment Processing
- Secure payment integration with Stripe
- Support for various payment methods
- Payment status tracking
- Refund processing for cancellations

### Notifications
- Email confirmations for bookings
- E-ticket generation and delivery
- Flight status notifications
- Booking reminders and updates

### Admin Features
- Flight management (create, update, cancel)
- Airport management
- User administration
- Booking oversight and intervention

## Architecture

### Tech Stack
- **Framework**: NestJS (TypeScript)
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT with Supabase integration
- **Documentation**: Swagger/OpenAPI
- **Testing**: Jest
- **Payments**: Stripe
- **Email**: Nodemailer
- **Containerization**: Docker

### High-Level Architecture
```
┌─────────────────┐      ┌──────────────────┐      ┌───────────────┐
│                 │      │                  │      │               │
│  API Gateway    │─────▶│  NestJS Backend  │─────▶│  PostgreSQL   │
│                 │      │                  │      │               │
└─────────────────┘      └──────────────────┘      └───────────────┘
                                 │  ▲
                                 │  │
                                 ▼  │
┌─────────────────┐      ┌──────────────────┐      ┌───────────────┐
│                 │      │                  │      │               │
│  Supabase Auth  │◀────▶│  External APIs   │◀────▶│  Stripe       │
│                 │      │  (Email, etc.)   │      │               │
└─────────────────┘      └──────────────────┘      └───────────────┘
```

### Module Organization
- **User Module**: Authentication, profile management
- **Flight Module**: Flight search, status management
- **Booking Module**: Reservation process, seat management
- **Payment Module**: Payment processing, refunds
- **Admin Module**: Administrative functions
- **Notification Module**: Email and alerts

## Data Model

The system is built around these core entities:
- **UserProfile**: Customer information and preferences
- **Flight**: Flight details including schedule and capacity
- **Airport**: Origin and destination information
- **Seat**: Physical seat mapping on flights
- **Booking**: Reservation details with passenger information
- **SeatLock**: Temporary reservation during booking process

## API Flow

### Booking Flow
1. User searches for flights with criteria
2. System returns available flights
3. User selects a flight and cabin class
4. System displays available seats
5. User selects seats and inputs passenger details
6. System creates a temporary booking and locks seats
7. User completes payment through Stripe
8. System confirms booking and generates e-ticket
9. Confirmation email sent to user

### Flight Status Updates
1. Admin updates flight status
2. System processes status change
3. Affected bookings are identified
4. Notifications sent to relevant passengers

## Tradeoffs and Design Decisions

### Performance vs. Consistency
- Temporary seat locking mechanism ensures booking integrity while maintaining system performance
- Caching strategies for frequently accessed flight data

### Security vs. User Experience
- JWT-based authentication with reasonable expiration times
- Stripe integration for secure payment processing, avoiding storing sensitive payment details

### Scalability Considerations
- Stateless API design for horizontal scaling
- Database schema optimized for booking operations

### Testing Strategy
- Unit tests for core business logic
- Integration tests for API endpoints
- End-to-end tests for critical flows (booking, payment)

## Getting Started

### Prerequisites
- Node.js 14+ and npm
- PostgreSQL
- Stripe account (for payment processing)
- SMTP server (for email notifications)

### Installation

1. Clone the repository
```bash
git clone https://github.com/yourusername/flightsbooking-backend.git
cd flightsbooking-backend
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Run database migrations
```bash
npx prisma migrate dev
```

5. Seed the database
```bash
npm run prisma:seed
```

6. Start the development server
```bash
npm run start:dev
```

7. Access the API documentation
```
http://localhost:4000/docs
```

### Docker Deployment

```bash
docker-compose up -d
```

## API Documentation

Interactive API documentation is available at `/docs` when the server is running.

## Testing

```bash
# Unit tests
npm run test

# Test coverage
npm run test:cov

# E2E tests
npm run test:e2e
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Installation

```bash
$ npm install
```

## Running the app

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Test

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://kamilmysliwiec.com)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](LICENSE).

## Scheduled Tasks

### Booking Expiration

The application automatically expires pending bookings after a configured time period (default: 30 minutes).

### Flight Status Updates

The system includes an automatic flight status update service that runs every 2 minutes. It performs the following actions:

- Fetches all flights within a recent time window
- Determines the appropriate status for each flight based on departure and arrival times
- Updates flight statuses in the database when changes are detected
- Sends notifications to affected bookings

Flight statuses include:
- Scheduled: Default for future flights
- Boarding: 60 minutes before departure
- Delayed: Random chance (10%) for flights within 2 hours of departure
- InAir: After departure and before arrival
- Landed: After arrival time

Manual flight status updates can be triggered via the API:
```bash
curl -X POST http://localhost:4000/flight-status/update
```

## Deployment

### Using Docker

The application can be deployed using Docker and Docker Compose. This provides an isolated environment with all necessary dependencies.

#### Prerequisites
- Docker and Docker Compose installed on your server
- Access to environment variables file (.env)

#### Steps to Deploy

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd flightsbooking-backend
   ```

2. **Configure environment variables**
   Create a `.env` file with all required variables or use the `.env.example` as a template:
   ```bash
   cp .env.example .env
   # Edit .env to set proper values for your environment
   ```

3. **Build and start the containers**
   ```bash
   docker-compose up -d
   ```
   This will start both the API server and PostgreSQL database.

4. **Apply database migrations**
   ```bash
   docker-compose exec api npx prisma migrate deploy
   ```

5. **Seed the database (optional)**
   ```bash
   docker-compose exec api npm run prisma:seed
   ```

6. **Verify deployment**
   The API will be accessible at `http://<your-server-ip>:4000`
   Swagger documentation is available at `http://<your-server-ip>:4000/api`

### Scaling and Production Considerations

For production environments:

1. **Environment Variables**: Ensure all sensitive information is set via environment variables, not hardcoded
2. **Database Backups**: Configure regular backups for the PostgreSQL database
3. **Logging**: Logs are stored in the `./logs` directory mapped to the container
4. **Monitoring**: Set up monitoring for container health and application metrics
5. **SSL/TLS**: For production, configure HTTPS using a reverse proxy like Nginx

stripe listen --forward-to localhost:4000/webhook