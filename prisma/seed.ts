import { PrismaClient } from '@prisma/client';
import { CabinClass, FlightStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create airports
  const airports = await Promise.all([
    prisma.airport.upsert({
      where: { code: 'JFK' },
      update: {},
      create: {
        code: 'JFK',
        name: 'John F. Kennedy International Airport',
        city: 'New York',
        country: 'USA',
        timezone: 'America/New_York',
      },
    }),
    prisma.airport.upsert({
      where: { code: 'LAX' },
      update: {},
      create: {
        code: 'LAX',
        name: 'Los Angeles International Airport',
        city: 'Los Angeles',
        country: 'USA',
        timezone: 'America/Los_Angeles',
      },
    }),
    prisma.airport.upsert({
      where: { code: 'LHR' },
      update: {},
      create: {
        code: 'LHR',
        name: 'London Heathrow Airport',
        city: 'London',
        country: 'UK',
        timezone: 'Europe/London',
      },
    }),
    prisma.airport.upsert({
      where: { code: 'CDG' },
      update: {},
      create: {
        code: 'CDG',
        name: 'Charles de Gaulle Airport',
        city: 'Paris',
        country: 'France',
        timezone: 'Europe/Paris',
      },
    }),
    prisma.airport.upsert({
      where: { code: 'SIN' },
      update: {},
      create: {
        code: 'SIN',
        name: 'Singapore Changi Airport',
        city: 'Singapore',
        country: 'Singapore',
        timezone: 'Asia/Singapore',
      },
    }),
  ]);

  console.log('Created airports:', airports.map((a) => a.code).join(', '));

  // Create flights
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);

  const dayAfterTomorrow = new Date(tomorrow);
  dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

  const jfkAirport = airports.find((a) => a.code === 'JFK');
  const laxAirport = airports.find((a) => a.code === 'LAX');
  const lhrAirport = airports.find((a) => a.code === 'LHR');
  const cdgAirport = airports.find((a) => a.code === 'CDG');
  const sinAirport = airports.find((a) => a.code === 'SIN');

  if (!jfkAirport || !laxAirport || !lhrAirport || !cdgAirport || !sinAirport) {
    throw new Error('Could not find all required airports');
  }

  // Create flights
  const flights = await Promise.all([
    // JFK to LAX
    prisma.flight.create({
      data: {
        flightNumber: 'AA100',
        airline: 'American Airlines',
        aircraftType: 'Boeing 787',
        departureTime: new Date(tomorrow.setHours(8, 0, 0, 0)),
        arrivalTime: new Date(tomorrow.setHours(11, 30, 0, 0)),
        duration: 330, // 5.5 hours in minutes
        originId: jfkAirport.id,
        destinationId: laxAirport.id,
        basePrice: 299.99,
        totalSeats: {
          [CabinClass.Economy]: 150,
          [CabinClass.PremiumEconomy]: 50,
          [CabinClass.Business]: 30,
          [CabinClass.First]: 10,
        },
        status: FlightStatus.Scheduled,
      },
    }),
    // LAX to JFK
    prisma.flight.create({
      data: {
        flightNumber: 'AA101',
        airline: 'American Airlines',
        aircraftType: 'Boeing 787',
        departureTime: new Date(tomorrow.setHours(14, 0, 0, 0)),
        arrivalTime: new Date(tomorrow.setHours(22, 30, 0, 0)),
        duration: 330, // 5.5 hours in minutes
        originId: laxAirport.id,
        destinationId: jfkAirport.id,
        basePrice: 329.99,
        totalSeats: {
          [CabinClass.Economy]: 150,
          [CabinClass.PremiumEconomy]: 50,
          [CabinClass.Business]: 30,
          [CabinClass.First]: 10,
        },
        status: FlightStatus.Scheduled,
      },
    }),
    // JFK to LHR
    prisma.flight.create({
      data: {
        flightNumber: 'BA178',
        airline: 'British Airways',
        aircraftType: 'Airbus A380',
        departureTime: new Date(tomorrow.setHours(19, 0, 0, 0)),
        arrivalTime: new Date(dayAfterTomorrow.setHours(7, 30, 0, 0)),
        duration: 420, // 7 hours in minutes
        originId: jfkAirport.id,
        destinationId: lhrAirport.id,
        basePrice: 599.99,
        totalSeats: {
          [CabinClass.Economy]: 200,
          [CabinClass.PremiumEconomy]: 60,
          [CabinClass.Business]: 40,
          [CabinClass.First]: 15,
        },
        status: FlightStatus.Scheduled,
      },
    }),
  ]);

  console.log(
    'Created flights:',
    flights.map((f) => f.flightNumber).join(', '),
  );

  // Create seats for each flight
  for (const flight of flights) {
    const cabinClasses = Object.keys(flight.totalSeats) as CabinClass[];

    for (const cabin of cabinClasses) {
      const seatCount = flight.totalSeats[cabin];
      const rows = Math.ceil(seatCount / 6); // Assuming 6 seats per row

      const seatLetters = ['A', 'B', 'C', 'D', 'E', 'F'];
      const seats = [];

      for (let row = 1; row <= rows; row++) {
        for (let seatIndex = 0; seatIndex < 6; seatIndex++) {
          if (seats.length < seatCount) {
            const seatNumber = `${row}${seatLetters[seatIndex]}`;
            seats.push({
              flightId: flight.id,
              seatNumber,
              cabin,
              position: { row, column: seatLetters[seatIndex] },
              isBlocked: false,
            });
          }
        }
      }

      await prisma.seat.createMany({
        data: seats,
        skipDuplicates: true,
      });
    }
  }

  console.log('Created seats for all flights');
  console.log('Database seeding completed');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
