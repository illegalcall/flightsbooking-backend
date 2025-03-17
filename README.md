<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="200" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://coveralls.io/github/nestjs/nest?branch=master" target="_blank"><img src="https://coveralls.io/repos/github/nestjs/nest/badge.svg?branch=master#9" alt="Coverage" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

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