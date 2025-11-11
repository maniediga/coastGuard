import crypto from "crypto";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
dotenv.config();

export function genRefreshToken() {
    return crypto.randomBytes(64).toString("hex"); // 128 hex chars
}

export async function hashPassword(password: string) {
    const rounds = Number(process.env.BCRYPT_SALT_ROUNDS || 12);
    return bcrypt.hash(password, rounds);
}

export async function comparePassword(password: string, hash: string) {
    return bcrypt.compare(password, hash);
}

export async function hashToken(token: string) {
    const rounds = Number(process.env.BCRYPT_SALT_ROUNDS || 12);
    return bcrypt.hash(token, rounds);
}

export async function compareToken(token: string, hash: string) {
    return bcrypt.compare(token, hash);
}
