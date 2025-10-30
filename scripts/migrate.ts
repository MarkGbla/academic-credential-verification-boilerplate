import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { database } from '../src/lib/database/DatabaseModule';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
  try {
    console.log('Running database migrations...');
    
    // Connect to the database
    await database.connect();
    
    // Run Prisma migrations
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });
    
    console.log('Database migrations completed successfully');
  } catch (error) {
    console.error('Error running migrations:', error);
    process.exit(1);
  } finally {
    await database.disconnect();
  }
}

runMigrations();
