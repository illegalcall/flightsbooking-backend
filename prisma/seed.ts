import { PrismaClient, CabinClass } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database with Indian airports and flights...');

  // Clear existing data
  await clearDatabase();

  // Seed airports
  const airports = await seedIndianAirports();

  // Seed flights
  await seedFlights(airports);

  // Seed a test user
  await seedTestUser();

  console.log('Database seeding completed successfully!');
}

/**
 * Clear existing data from the database
 */
async function clearDatabase() {
  console.log('Clearing existing data...');
  await prisma.seatLock.deleteMany({});
  await prisma.booking.deleteMany({});
  await prisma.seat.deleteMany({});
  await prisma.flight.deleteMany({});
  await prisma.airport.deleteMany({});
  // await prisma.userProfile.deleteMany({});
  console.log('Database cleared!');
}

/**
 * Seed Indian airports data
 * @returns Map of airport codes to their database IDs
 */
async function seedIndianAirports() {
  console.log('Seeding Indian airports...');

  const airportsData = [
    {
      code: 'DEL',
      name: 'Indira Gandhi International Airport',
      city: 'Delhi',
      country: 'India',
      timezone: 'Asia/Kolkata',
    },
    {
      code: 'BOM',
      name: 'Chhatrapati Shivaji Maharaj International Airport',
      city: 'Mumbai',
      country: 'India',
      timezone: 'Asia/Kolkata',
    },
    {
      code: 'MAA',
      name: 'Chennai International Airport',
      city: 'Chennai',
      country: 'India',
      timezone: 'Asia/Kolkata',
    },
    {
      code: 'BLR',
      name: 'Kempegowda International Airport',
      city: 'Bangalore',
      country: 'India',
      timezone: 'Asia/Kolkata',
    },
    {
      code: 'HYD',
      name: 'Rajiv Gandhi International Airport',
      city: 'Hyderabad',
      country: 'India',
      timezone: 'Asia/Kolkata',
    },
    {
      code: 'CCU',
      name: 'Netaji Subhas Chandra Bose International Airport',
      city: 'Kolkata',
      country: 'India',
      timezone: 'Asia/Kolkata',
    },
    {
      code: 'COK',
      name: 'Cochin International Airport',
      city: 'Kochi',
      country: 'India',
      timezone: 'Asia/Kolkata',
    },
    {
      code: 'AMD',
      name: 'Sardar Vallabhbhai Patel International Airport',
      city: 'Ahmedabad',
      country: 'India',
      timezone: 'Asia/Kolkata',
    },
    {
      code: 'GOI',
      name: 'Dabolim Airport',
      city: 'Goa',
      country: 'India',
      timezone: 'Asia/Kolkata',
    },
    {
      code: 'JAI',
      name: 'Jaipur International Airport',
      city: 'Jaipur',
      country: 'India',
      timezone: 'Asia/Kolkata',
    },
  ];

  const airportMap = new Map<string, string>();

  for (const airportData of airportsData) {
    const airport = await prisma.airport.create({
      data: airportData,
    });
    airportMap.set(airport.code, airport.id);
  }

  console.log(`Seeded ${airportsData.length} Indian airports!`);
  return airportMap;
}

/**
 * Seed flights data
 * @param airports Map of airport codes to their database IDs
 */
async function seedFlights(airports: Map<string, string>) {
  console.log('Seeding flights between Indian cities...');

  // Define the routes (domestic Indian routes)
  const routes = [
    { origin: 'DEL', destination: 'BOM' },
    { origin: 'BOM', destination: 'DEL' },
    { origin: 'DEL', destination: 'BLR' },
    { origin: 'BLR', destination: 'DEL' },
    { origin: 'BOM', destination: 'MAA' },
    { origin: 'MAA', destination: 'BOM' },
    { origin: 'BLR', destination: 'HYD' },
    { origin: 'HYD', destination: 'BLR' },
    { origin: 'DEL', destination: 'CCU' },
    { origin: 'CCU', destination: 'DEL' },
    { origin: 'BOM', destination: 'GOI' },
    { origin: 'GOI', destination: 'BOM' },
    { origin: 'DEL', destination: 'JAI' },
    { origin: 'JAI', destination: 'DEL' },
    { origin: 'BLR', destination: 'COK' },
    { origin: 'COK', destination: 'BLR' },
    { origin: 'MAA', destination: 'CCU' },
    { origin: 'CCU', destination: 'MAA' },
    { origin: 'HYD', destination: 'AMD' },
    { origin: 'AMD', destination: 'HYD' },
  ];

  // Define Indian airlines
  const airlines = [
    'Air India',
    'IndiGo',
    'SpiceJet',
    'Vistara',
    'Air Asia India',
    'Go First',
    'Alliance Air',
    'Star Air',
    'TruJet',
    'Akasa Air',
  ];

  // Define aircraft types
  const aircraftTypes = [
    'Airbus A320',
    'Airbus A321',
    'Boeing 737',
    'Boeing 777',
    'Boeing 787 Dreamliner',
    'ATR 72',
    'Bombardier Q400',
    'Airbus A350',
    'Embraer E190',
    'Airbus A330',
  ];

  // Reduce the number of days for faster seeding
  const daysToSeed = 7; // Reduced from 30 to 7 days
  console.log(`Creating flights for the next ${daysToSeed} days...`);

  // Create flights for the next daysToSeed days
  const today = new Date();
  let seededFlights = 0;
  let flightBatch = [];

  for (let day = 0; day < daysToSeed; day++) {
    const currentDate = new Date(today);
    currentDate.setDate(currentDate.getDate() + day);
    console.log(
      `Seeding flights for day ${
        day + 1
      }/${daysToSeed}: ${currentDate.toDateString()}`,
    );

    for (const route of routes) {
      // Skip some days randomly to create more realistic schedule
      if (Math.random() < 0.2) continue;

      // Create 1-3 flights per route per day (reduced from 1-5)
      const flightsPerDay = Math.floor(Math.random() * 3) + 1;

      for (let i = 0; i < flightsPerDay; i++) {
        const airline = airlines[Math.floor(Math.random() * airlines.length)];
        const aircraftType =
          aircraftTypes[Math.floor(Math.random() * aircraftTypes.length)];

        // Create random departure time
        const departureTime = new Date(currentDate);
        departureTime.setHours(5 + Math.floor(Math.random() * 18)); // Between 5 AM and 11 PM
        departureTime.setMinutes(Math.random() < 0.5 ? 0 : 30); // Either on the hour or half past

        // Calculate flight duration based on route (in minutes)
        let duration = 0;
        if (route.origin === 'DEL' && route.destination === 'BOM') {
          duration = 130; // 2h 10m Delhi to Mumbai
        } else if (route.origin === 'DEL' && route.destination === 'BLR') {
          duration = 170; // 2h 50m Delhi to Bangalore
        } else if (route.origin === 'BOM' && route.destination === 'MAA') {
          duration = 135; // 2h 15m Mumbai to Chennai
        } else if (route.origin === 'BLR' && route.destination === 'HYD') {
          duration = 65; // 1h 5m Bangalore to Hyderabad
        } else if (route.origin === 'DEL' && route.destination === 'CCU') {
          duration = 145; // 2h 25m Delhi to Kolkata
        } else if (route.origin === 'BOM' && route.destination === 'GOI') {
          duration = 70; // 1h 10m Mumbai to Goa
        } else if (route.origin === 'DEL' && route.destination === 'JAI') {
          duration = 55; // 55m Delhi to Jaipur
        } else if (route.origin === 'BLR' && route.destination === 'COK') {
          duration = 70; // 1h 10m Bangalore to Kochi
        } else if (route.origin === 'MAA' && route.destination === 'CCU') {
          duration = 150; // 2h 30m Chennai to Kolkata
        } else if (route.origin === 'HYD' && route.destination === 'AMD') {
          duration = 130; // 2h 10m Hyderabad to Ahmedabad
        } else {
          // For routes in the opposite direction, use same duration
          const reverseRoute = routes.find(
            (r) =>
              r.origin === route.destination && r.destination === route.origin,
          );
          if (reverseRoute) {
            const routeKey = `${reverseRoute.origin}-${reverseRoute.destination}`;
            duration = 120; // Default 2 hours if not specifically defined
          }
        }

        // Calculate arrival time
        const arrivalTime = new Date(departureTime);
        arrivalTime.setMinutes(arrivalTime.getMinutes() + duration);

        // Set base price with some randomness (Indian domestic flight prices in USD)
        const basePrice = Math.floor(50 + Math.random() * 150);

        // Set seat capacity based on aircraft type
        let totalSeats: Record<string, number> = {};

        // Different aircraft types have different seating configurations
        if (aircraftType.includes('A350') || aircraftType.includes('777')) {
          totalSeats = {
            [CabinClass.Economy]: 250,
            [CabinClass.PremiumEconomy]: 50,
            [CabinClass.Business]: 30,
            [CabinClass.First]: 8,
          };
        } else if (
          aircraftType.includes('787') ||
          aircraftType.includes('A330')
        ) {
          totalSeats = {
            [CabinClass.Economy]: 200,
            [CabinClass.PremiumEconomy]: 35,
            [CabinClass.Business]: 20,
            [CabinClass.First]: 6,
          };
        } else if (
          aircraftType.includes('A321') ||
          aircraftType.includes('737')
        ) {
          totalSeats = {
            [CabinClass.Economy]: 160,
            [CabinClass.PremiumEconomy]: 25,
            [CabinClass.Business]: 12,
            [CabinClass.First]: 0, // No first class on A321/737
          };
        } else if (aircraftType.includes('A320')) {
          totalSeats = {
            [CabinClass.Economy]: 150,
            [CabinClass.PremiumEconomy]: 18,
            [CabinClass.Business]: 8,
            [CabinClass.First]: 0, // No first class on A320
          };
        } else {
          // Smaller aircraft like ATR 72 or Q400
          totalSeats = {
            [CabinClass.Economy]: 70,
            [CabinClass.PremiumEconomy]: 0,
            [CabinClass.Business]: 6,
            [CabinClass.First]: 0, // No premium options on regional aircraft
          };
        }

        // Generate flight number - Using Indian airline codes
        let airlinePrefix;
        if (airline === 'Air India') airlinePrefix = 'AI';
        else if (airline === 'IndiGo') airlinePrefix = '6E';
        else if (airline === 'SpiceJet') airlinePrefix = 'SG';
        else if (airline === 'Vistara') airlinePrefix = 'UK';
        else if (airline === 'Air Asia India') airlinePrefix = 'I5';
        else if (airline === 'Go First') airlinePrefix = 'G8';
        else if (airline === 'Alliance Air') airlinePrefix = '9I';
        else if (airline === 'Star Air') airlinePrefix = 'OG';
        else if (airline === 'TruJet') airlinePrefix = '2T';
        else if (airline === 'Akasa Air') airlinePrefix = 'QP';
        else airlinePrefix = 'IN';

        const flightNumber = `${airlinePrefix}${
          100 + Math.floor(Math.random() * 900)
        }`;

        // Add to flight batch instead of creating immediately
        flightBatch.push({
          flightNumber,
          airline,
          aircraftType,
          departureTime,
          arrivalTime,
          duration,
          originId: airports.get(route.origin)!,
          destinationId: airports.get(route.destination)!,
          basePrice,
          totalSeats,
          status: 'Scheduled',
        });

        // Process in batches of 20 flights
        if (flightBatch.length >= 20) {
          await processBatchOfFlights(flightBatch);
          seededFlights += flightBatch.length;
          console.log(`Progress: ${seededFlights} flights processed`);
          flightBatch = [];
        }
      }
    }
  }

  // Process any remaining flights
  if (flightBatch.length > 0) {
    await processBatchOfFlights(flightBatch);
    seededFlights += flightBatch.length;
  }

  console.log(`Seeded ${seededFlights} flights with seats!`);
}

/**
 * Process a batch of flights and create seats for them
 * @param flightBatch Array of flight data to create
 */
async function processBatchOfFlights(flightBatch: any[]) {
  console.log(`Processing batch of ${flightBatch.length} flights...`);

  const createdFlights: { id: string; totalSeats: Record<string, number> }[] =
    [];

  try {
    // Create all flights in one batch operation
    const flights = await prisma.flight.createMany({
      data: flightBatch.map(({ totalSeats, ...flightData }) => flightData),
      skipDuplicates: true, // Skip if flight number already exists
    });

    console.log(`Successfully created ${flights.count} flights in batch`);

    // Fetch the created flights to get their IDs
    const createdFlightRecords = await prisma.flight.findMany({
      where: {
        flightNumber: {
          in: flightBatch.map((f) => f.flightNumber),
        },
      },
      select: {
        id: true,
        flightNumber: true,
      },
    });

    // Map the flight records with their totalSeats configuration
    for (const record of createdFlightRecords) {
      const originalFlight = flightBatch.find(
        (f) => f.flightNumber === record.flightNumber,
      );
      if (originalFlight) {
        createdFlights.push({
          id: record.id,
          totalSeats: originalFlight.totalSeats,
        });
      }
    }
  } catch (error) {
    console.error('Failed to create flights batch:', error);
    // Log detailed error for each flight in the batch
    flightBatch.forEach((flight) => {
      console.error(
        `Flight ${flight.flightNumber}: ${flight.airline} from ${flight.originId} to ${flight.destinationId}`,
      );
    });
    throw new Error('Flight creation failed. See logs for details.');
  }

  // Create seats for each flight in sequence to avoid memory issues
  for (const { id, totalSeats } of createdFlights) {
    try {
      await createSeatsForFlight(id, totalSeats);
    } catch (error) {
      console.error(`Failed to create seats for flight ${id}:`, error);
      // Continue with next flight even if seat creation fails for one
    }
  }

  console.log(
    `Completed processing batch of ${createdFlights.length} flights with seats`,
  );
}

/**
 * Create seat records for a flight
 * @param flightId The flight ID
 * @param totalSeats The total seats configuration
 */
async function createSeatsForFlight(
  flightId: string,
  totalSeats: Record<string, number>,
) {
  // Define seat configurations per cabin
  const seatsByClass: Record<CabinClass, { rows: number; cols: string[] }> = {
    [CabinClass.First]: {
      rows: Math.ceil(totalSeats[CabinClass.First] / 2),
      cols: ['A', 'D'],
    },
    [CabinClass.Business]: {
      rows: Math.ceil(totalSeats[CabinClass.Business] / 4),
      cols: ['A', 'D', 'G', 'K'],
    },
    [CabinClass.PremiumEconomy]: {
      rows: Math.ceil(totalSeats[CabinClass.PremiumEconomy] / 6),
      cols: ['A', 'C', 'D', 'G', 'H', 'K'],
    },
    [CabinClass.Economy]: {
      rows: Math.ceil(totalSeats[CabinClass.Economy] / 9),
      cols: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'K'],
    },
  };

  // Generate seats for each cabin class
  const seatData = [];

  // First class seats
  if (totalSeats[CabinClass.First] > 0) {
    const config = seatsByClass[CabinClass.First];
    for (let row = 1; row <= config.rows; row++) {
      for (const col of config.cols) {
        seatData.push({
          flightId,
          seatNumber: `1${row}${col}`,
          cabin: CabinClass.First,
          position: { row, col },
          isBlocked: false,
        });
      }
    }
  }

  // Business class seats
  if (totalSeats[CabinClass.Business] > 0) {
    const config = seatsByClass[CabinClass.Business];
    for (let row = 1; row <= config.rows; row++) {
      for (const col of config.cols) {
        seatData.push({
          flightId,
          seatNumber: `2${row}${col}`,
          cabin: CabinClass.Business,
          position: { row, col },
          isBlocked: false,
        });
      }
    }
  }

  // Premium Economy seats
  if (totalSeats[CabinClass.PremiumEconomy] > 0) {
    const config = seatsByClass[CabinClass.PremiumEconomy];
    for (let row = 1; row <= config.rows; row++) {
      for (const col of config.cols) {
        seatData.push({
          flightId,
          seatNumber: `3${row}${col}`,
          cabin: CabinClass.PremiumEconomy,
          position: { row, col },
          isBlocked: false,
        });
      }
    }
  }

  // Economy seats
  if (totalSeats[CabinClass.Economy] > 0) {
    const config = seatsByClass[CabinClass.Economy];
    for (let row = 1; row <= config.rows; row++) {
      for (const col of config.cols) {
        seatData.push({
          flightId,
          seatNumber: `4${row}${col}`,
          cabin: CabinClass.Economy,
          position: { row, col },
          isBlocked: Math.random() < 0.05, // 5% chance of a seat being blocked
        });
      }
    }
  }

  // Create seats in batches
  for (let i = 0; i < seatData.length; i += 100) {
    const batch = seatData.slice(i, i + 100);
    await prisma.seat.createMany({
      data: batch,
    });
  }
}

/**
 * Seed a test user profile with Indian context
 */
async function seedTestUser() {
  console.log('Seeding test user with Indian context...');

  await prisma.userProfile.create({
    data: {
      userId: 'test-user-id', // This would match a Supabase Auth user ID
      fullName: 'Rajesh Kumar',
      email: 'rajesh.kumar@example.com',
      phone: '+919876543210',
      address: '42 Banjara Hills Road, Hyderabad, Telangana, India',
      birthdate: new Date('1988-04-15'),
      paymentInfo: {
        cards: [
          {
            lastFour: '5678',
            expiryMonth: 9,
            expiryYear: 2026,
            holderName: 'Rajesh Kumar',
          },
        ],
      },
      preferences: {
        seatPreference: 'aisle',
        mealPreference: 'hindu-vegetarian',
        frequentFlyerNumbers: {
          airIndia: 'AI5436789',
          vistara: 'UK7654321',
          indiGo: '6E9876543',
        },
      },
    },
  });

  console.log('Test user seeded!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
