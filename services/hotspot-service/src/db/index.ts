import pg from 'pg';
import 'dotenv/config'; // Loads variables from .env file

// Pool is much better than a single client for a server
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  // Example: "postgresql://your_user:your_password@localhost:5432/coastguard_db"
});

// Helper function to make queries
export const query = (text: string, params?: any[]) => {
  return pool.query(text, params);
};