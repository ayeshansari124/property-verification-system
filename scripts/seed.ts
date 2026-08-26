import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { properties, users } from '../src/database/schema';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

const propertyData = [
  {
    address: '1425 Sunset Boulevard',
    city: 'Los Angeles',
    state: 'California',
    zip: '90026',
    bedrooms: 3,
    bathrooms: 2,
    propertyType: 'Single Family',
    yearBuilt: 1985,
    livingArea: 1850,
    lotSize: 6200,
    heating: 'Central',
    cooling: 'Central Air',
    water: 'Public',
    sewer: 'Public',
    appliances: ['Refrigerator', 'Dishwasher', 'Oven', 'Microwave'],
    features: ['Garage', 'Backyard', 'Fireplace'],
    listingAgent: 'Michael Anderson',
    buyerAgent: null,
    status: 'ACTIVE',
  },
  {
    address: '2847 Maple Street',
    city: 'Austin',
    state: 'Texas',
    zip: '78704',
    bedrooms: 4,
    bathrooms: 3,
    propertyType: 'Single Family',
    yearBuilt: 2012,
    livingArea: 2450,
    lotSize: 7800,
    heating: 'Central',
    cooling: 'Central Air',
    water: 'Public',
    sewer: 'Public',
    appliances: ['Refrigerator', 'Dishwasher', 'Oven', 'Washer', 'Dryer'],
    features: ['Pool', 'Garage', 'Patio'],
    listingAgent: 'Sarah Mitchell',
    buyerAgent: null,
    status: 'ACTIVE',
  },
  {
    address: '731 Pine Avenue',
    city: 'Seattle',
    state: 'Washington',
    zip: '98101',
    bedrooms: 2,
    bathrooms: 2,
    propertyType: 'Condo',
    yearBuilt: 2018,
    livingArea: 1280,
    lotSize: 0,
    heating: 'Electric',
    cooling: 'Central Air',
    water: 'Public',
    sewer: 'Public',
    appliances: ['Refrigerator', 'Dishwasher', 'Oven'],
    features: ['Balcony', 'Parking', 'Elevator'],
    listingAgent: 'Daniel Carter',
    buyerAgent: null,
    status: 'ACTIVE',
  },
  {
    address: '918 Oak Ridge Drive',
    city: 'Denver',
    state: 'Colorado',
    zip: '80206',
    bedrooms: 3,
    bathrooms: 2,
    propertyType: 'Townhouse',
    yearBuilt: 2007,
    livingArea: 2100,
    lotSize: 3500,
    heating: 'Gas',
    cooling: 'Central Air',
    water: 'Public',
    sewer: 'Public',
    appliances: ['Refrigerator', 'Dishwasher', 'Oven', 'Microwave'],
    features: ['Garage', 'Deck', 'Basement'],
    listingAgent: 'Jennifer Wilson',
    buyerAgent: null,
    status: 'ACTIVE',
  },
  {
    address: '452 Lakeview Road',
    city: 'Chicago',
    state: 'Illinois',
    zip: '60614',
    bedrooms: 3,
    bathrooms: 2,
    propertyType: 'Single Family',
    yearBuilt: 1998,
    livingArea: 1950,
    lotSize: 5100,
    heating: 'Gas',
    cooling: 'Central Air',
    water: 'Public',
    sewer: 'Public',
    appliances: ['Refrigerator', 'Dishwasher', 'Oven'],
    features: ['Garage', 'Basement', 'Fireplace'],
    listingAgent: 'Robert Thompson',
    buyerAgent: null,
    status: 'ACTIVE',
  },
  {
    address: '615 River Street',
    city: 'Boston',
    state: 'Massachusetts',
    zip: '02116',
    bedrooms: 2,
    bathrooms: 1,
    propertyType: 'Condo',
    yearBuilt: 2015,
    livingArea: 1100,
    lotSize: 0,
    heating: 'Gas',
    cooling: 'Central Air',
    water: 'Public',
    sewer: 'Public',
    appliances: ['Refrigerator', 'Dishwasher', 'Oven'],
    features: ['Parking', 'Elevator', 'Balcony'],
    listingAgent: 'Emily Davis',
    buyerAgent: null,
    status: 'ACTIVE',
  },
  {
    address: '237 Willow Lane',
    city: 'Phoenix',
    state: 'Arizona',
    zip: '85016',
    bedrooms: 4,
    bathrooms: 3,
    propertyType: 'Single Family',
    yearBuilt: 2010,
    livingArea: 2680,
    lotSize: 8500,
    heating: 'Electric',
    cooling: 'Central Air',
    water: 'Public',
    sewer: 'Public',
    appliances: ['Refrigerator', 'Dishwasher', 'Oven', 'Microwave'],
    features: ['Pool', 'Garage', 'Patio'],
    listingAgent: 'Christopher Brown',
    buyerAgent: null,
    status: 'ACTIVE',
  },
  {
    address: '109 Garden Street',
    city: 'Portland',
    state: 'Oregon',
    zip: '97205',
    bedrooms: 3,
    bathrooms: 2,
    propertyType: 'Single Family',
    yearBuilt: 1995,
    livingArea: 1760,
    lotSize: 4900,
    heating: 'Gas',
    cooling: 'Central Air',
    water: 'Public',
    sewer: 'Public',
    appliances: ['Refrigerator', 'Dishwasher', 'Oven'],
    features: ['Garden', 'Garage', 'Fireplace'],
    listingAgent: 'Amanda Miller',
    buyerAgent: null,
    status: 'ACTIVE',
  },
  {
    address: '825 Highland Avenue',
    city: 'Atlanta',
    state: 'Georgia',
    zip: '30309',
    bedrooms: 4,
    bathrooms: 3,
    propertyType: 'Single Family',
    yearBuilt: 2003,
    livingArea: 2300,
    lotSize: 7200,
    heating: 'Gas',
    cooling: 'Central Air',
    water: 'Public',
    sewer: 'Public',
    appliances: ['Refrigerator', 'Dishwasher', 'Oven', 'Washer', 'Dryer'],
    features: ['Garage', 'Deck', 'Fireplace'],
    listingAgent: 'Matthew Johnson',
    buyerAgent: null,
    status: 'ACTIVE',
  },
  {
    address: '361 Magnolia Drive',
    city: 'Miami',
    state: 'Florida',
    zip: '33133',
    bedrooms: 3,
    bathrooms: 2,
    propertyType: 'Single Family',
    yearBuilt: 2016,
    livingArea: 2200,
    lotSize: 6700,
    heating: 'Electric',
    cooling: 'Central Air',
    water: 'Public',
    sewer: 'Public',
    appliances: ['Refrigerator', 'Dishwasher', 'Oven', 'Microwave'],
    features: ['Pool', 'Patio', 'Garage'],
    listingAgent: 'Jessica Martinez',
    buyerAgent: null,
    status: 'ACTIVE',
  },
];

// Generate 40 additional properties from the base data.
const propertiesToSeed = [
  ...propertyData,
  ...Array.from({ length: 40 }, (_, index) => {
    const base = propertyData[index % propertyData.length];

    return {
      ...base,
      address: `${1000 + index} ${['Oak', 'Maple', 'Pine', 'Cedar', 'Lake', 'Hill', 'River', 'Park'][index % 8]} Street`,
      bedrooms: 2 + (index % 4),
      bathrooms: 1 + (index % 3),
      livingArea: 1200 + index * 37,
      lotSize: 4000 + index * 125,
    };
  }),
];

async function seed() {
  try {
    // -------------------------
    // ADMIN
    // -------------------------

    const adminPassword = await bcrypt.hash('Admin@123', 10);

    const existingAdmin = await db
      .select()
      .from(users)
      .where(eq(users.email, 'admin@property.local'))
      .limit(1);

    if (existingAdmin.length === 0) {
      await db.insert(users).values({
        name: 'System Admin',
        email: 'admin@property.local',
        passwordHash: adminPassword,
        role: 'ADMIN',
      });

      console.log('Admin user created.');
    } else {
      console.log('Admin user already exists.');
    }

    // -------------------------
    // DATA CHECKER
    // -------------------------

    const checkerPassword = await bcrypt.hash('Checker@123', 10);

    const existingChecker = await db
      .select()
      .from(users)
      .where(eq(users.email, 'checker@property.local'))
      .limit(1);

    if (existingChecker.length === 0) {
      await db.insert(users).values({
        name: 'Data Checker',
        email: 'checker@property.local',
        passwordHash: checkerPassword,
        role: 'DATA_CHECKER',
      });

      console.log('Data Checker created.');
    } else {
      console.log('Data Checker already exists.');
    }

    // -------------------------
    // REVIEWER
    // -------------------------

    const reviewerPassword = await bcrypt.hash('Reviewer@123', 10);

    const existingReviewer = await db
      .select()
      .from(users)
      .where(eq(users.email, 'reviewer@property.local'))
      .limit(1);

    if (existingReviewer.length === 0) {
      await db.insert(users).values({
        name: 'Property Reviewer',
        email: 'reviewer@property.local',
        passwordHash: reviewerPassword,
        role: 'REVIEWER',
      });

      console.log('Reviewer created.');
    } else {
      console.log('Reviewer already exists.');
    }

    // -------------------------
    // PROPERTIES
    // -------------------------

    const existingProperties = await db.select().from(properties);

    if (existingProperties.length === 0) {
      await db.insert(properties).values(propertiesToSeed);

      console.log(`${propertiesToSeed.length} properties created.`);
    } else {
      console.log(
        `Properties already exist (${existingProperties.length}). Skipping property seed.`,
      );
    }

    console.log('Seed completed successfully.');
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
