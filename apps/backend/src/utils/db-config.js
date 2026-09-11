import { pool } from "../infrastructure/database/postgres-helpers.js";
import dotenv from "dotenv";

dotenv.config();

/**
 * Shared database pool helper.
 * Reuses the canonical shared pool from postgres-helpers to prevent connection leaks.
 */
export const createDbPool = () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is required");
  }
  return pool;
};

export { pool };
export default createDbPool;
