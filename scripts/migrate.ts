/**
 * Apply Drizzle migrations to the database in DATABASE_URL.
 *   npm run db:generate   # after schema changes, creates SQL in ./drizzle
 *   npm run db:migrate     # applies them
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

const db = drizzle(neon(url));
await migrate(db, { migrationsFolder: "./drizzle" });
console.log("Migrations applied.");
