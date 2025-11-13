
import { Pool } from "pg";
import dotenv from "dotenv";
dotenv.config();

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // or host, port, user, etc. (based on what you used)
});

pool.connect()
  .then(() => console.log("[INFO] ✅ Connected to PostgreSQL successfully"))
  .catch((err) => console.error("❌ PostgreSQL connection error:", err));
