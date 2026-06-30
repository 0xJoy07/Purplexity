import { PrismaClient } from "../generated";
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

// Prisma Client for database operations
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
});

// Supabase Client for authentication and storage
export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

// Graceful shutdown
process.on("beforeExit", async () => {
  await prisma.$disconnect();
});

// Test database connection
export async function testDatabaseConnection() {
  try {
    await prisma.$connect();
    console.log("Database connected successfully");
    return true;
  } catch (error) {
    console.error("Database connection failed:", error);
    return false;
  }
}
