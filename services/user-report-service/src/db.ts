import type { QueryResult, QueryResultRow } from "pg";
import { Pool } from "pg";
import dotenv from "dotenv";
dotenv.config();

export const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

export async function query<T extends QueryResultRow>(
    sql: string,
    params: any[] = []
): Promise<T[]> {
    const result: QueryResult<T> = await pool.query<T>(sql, params);
    return result.rows;
}

export async function queryOne<T extends QueryResultRow>(
    sql: string,
    params: any[] = []
): Promise<T | null> {
    const result: QueryResult<T> = await pool.query<T>(sql, params);
    return result.rows[0] || null;
}

export async function execute(
    sql: string,
    params: any[] = []
): Promise<number> {
    const result = await pool.query(sql, params);
    return result.rowCount || 0;
}
