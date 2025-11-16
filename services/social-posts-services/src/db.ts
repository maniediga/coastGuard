import { Pool } from "pg";
import dotenv from "dotenv";
dotenv.config();

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function query(sql: string, params: any[] = []) {
  const result = await pool.query(sql, params);
  return result.rows;
}
