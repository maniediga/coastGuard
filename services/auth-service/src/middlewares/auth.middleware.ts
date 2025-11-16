import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../jwt.js";
import { pool } from "../db.js";

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
    const a = req.get("Authorization") || "";
    const parts = a.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") return res.status(401).json({ error: "no token" });
    // workaround to not get typescript to yell at me for assigning string | undefined to string.
    const token: string = parts[1] || "";

    try {
        const payload: any = verifyAccessToken(token);
        // check session in DB
        const s = await pool.query("SELECT revoked, expires_at FROM sessions WHERE session_id=$1", [payload.session_id]);
        if (s.rowCount === 0) return res.status(401).json({ error: "session not found" });
        const session = s.rows[0];
        if (session.revoked || new Date(session.expires_at) < new Date()) return res.status(401).json({ error: "session revoked/expired" });

        // attach user info
        (req as any).auth = { user_id: payload.sub, role: payload.role, session_id: payload.session_id };
        return next();
    } catch (err) {
        return res.status(401).json({ error: "invalid_token" });
    }
}

export function requireRole(roleId: number) {
    return (req: Request, res: Response, next: NextFunction) => {
        const a = (req as any).auth;
        if (!a) return res.status(401).json({ error: "unauth" });
        if (a.role !== roleId) return res.status(403).json({ error: "forbidden" });
        return next();
    };

}
