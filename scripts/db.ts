#!/usr/bin/env node
import { Command } from 'commander';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const program = new Command();

program
  .name('db')
  .description('Database management CLI')
  .version('1.0.0');

program
  .command('migrate')
  .description('Run database migrations')
  .action(() => {
    try {
      console.log('Running database migrations...');
      execSync('npx prisma migrate deploy', { stdio: 'inherit' });
      console.log('Migrations completed successfully');
    } catch (error) {
      console.error('Error running migrations:', error);
      process.exit(1);
    }
  });

program
  .command('generate')
  .description('Generate Prisma client')
  .action(() => {
    try {
      console.log('Generating Prisma client...');
      execSync('npx prisma generate', { stdio: 'inherit' });
      console.log('Prisma client generated successfully');
    } catch (error) {
      console.error('Error generating Prisma client:', error);
      process.exit(1);
    }
  });

program
  .command('studio')
  .description('Open Prisma Studio')
  .action(() => {
    try {
      console.log('Opening Prisma Studio...');
      execSync('npx prisma studio', { stdio: 'inherit' });
    } catch (error) {
      console.error('Error opening Prisma Studio:', error);
      process.exit(1);
    }
  });

program
  .command('reset')
  .description('Reset the database (DANGER: This will drop all data!)')
  .action(() => {
    try {
      console.log('Resetting database...');
      execSync('npx prisma migrate reset --force', { stdio: 'inherit' });
      console.log('Database reset successfully');
    } catch (error) {
      console.error('Error resetting database:', error);
      process.exit(1);
    }
  });

program.parse(process.argv);
