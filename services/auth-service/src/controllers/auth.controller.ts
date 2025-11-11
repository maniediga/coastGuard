import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { signAccessToken } from "../jwt.js";
import { genRefreshToken, hashToken, compareToken } from "../utils/token.utils.js";
import { ApiError } from "../utils/api.error.js";
import { ApiResponse } from "../utils/api.response.js";
import * as AuthService from "../services/auth.services.js";
import { v7 as uuidv7 } from "uuid";
import { HTTP_RESPONSE_CODE } from "../constants/api.response.codes.js";

const REFRESH_EXPIRES_DAYS = Number(process.env.REFRESH_TOKEN_EXPIRES_DAYS || 30);

function addDays(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString();
}

export async function register(req: Request, res: Response) {
    const { email, password, user_name, phone } = req.body;
    if (!email || !password || !user_name)
        throw new ApiError(HTTP_RESPONSE_CODE.BAD_REQUEST, "Missing required fields");

    const existing = await AuthService.findUserByEmail(email);
    if (existing) throw new ApiError(HTTP_RESPONSE_CODE.CONFLICT, "Email already registered");

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await AuthService.createUser(user_name, email, hashedPassword, phone);

    res.status(HTTP_RESPONSE_CODE.CREATED).json(new ApiResponse(user, "User registered successfully"));
}

export async function login(req: Request, res: Response) {
    const { email, password } = req.body;
    if (!email || !password) throw new ApiError(HTTP_RESPONSE_CODE.BAD_REQUEST, "Missing credentials");

    const user = await AuthService.findUserByEmail(email);
    if (!user) throw new ApiError(HTTP_RESPONSE_CODE.UNAUTHORIZED, "Invalid credentials");

    const ok = await bcrypt.compare(password, user.hashed_password || "");
    if (!ok) throw new ApiError(HTTP_RESPONSE_CODE.UNAUTHORIZED, "Invalid credentials");

    // create session
    const tokenId = uuidv7();
    const secret = genRefreshToken();
    const refreshTokenHash = await hashToken(secret);
    const expiresAt = addDays(REFRESH_EXPIRES_DAYS);

    await AuthService.createSession(
        user.user_id,
        tokenId,
        refreshTokenHash,
        req.ip || "",
        req.get("User-Agent") || "unknown",
        expiresAt
    );

    const accessToken = signAccessToken({
        sub: user.user_id,
        role: user.user_role_id,
        token_id: tokenId
    });
    const refreshToken = `${tokenId}.${secret}`;

    res.status(HTTP_RESPONSE_CODE.SUCCESS).json(
        new ApiResponse(
            {
                access_token: accessToken,
                refresh_token: refreshToken,
                token_type: "bearer",
                expires_in: 15 * 60
            },
            "Login successful"
        )
    );
}

export async function refreshToken(req: Request, res: Response) {
    const { refresh_token } = req.body;
    if (!refresh_token) throw new ApiError(HTTP_RESPONSE_CODE.BAD_REQUEST, "Missing refresh_token");

    const parts = refresh_token.split(".");
    if (parts.length !== 2) throw new ApiError(HTTP_RESPONSE_CODE.BAD_REQUEST, "Malformed token");

    const [tokenId, secret] = parts;
    const session = await AuthService.findSessionByTokenId(tokenId);
    if (!session) throw new ApiError(HTTP_RESPONSE_CODE.UNAUTHORIZED, "Invalid refresh token");

    if (session.revoked || new Date(session.expires_at) < new Date())
        throw new ApiError(HTTP_RESPONSE_CODE.UNAUTHORIZED, "Expired or revoked refresh token");

    const valid = await compareToken(secret, session.refresh_token_hash);
    if (!valid) {
        await AuthService.revokeAllSessionsForUser(session.user_id);
        throw new ApiError(HTTP_RESPONSE_CODE.UNAUTHORIZED, "Refresh token reuse detected");
    }

    // rotate
    const newTokenId = uuidv7();
    const newSecret = genRefreshToken();
    const newHash = await hashToken(newSecret);
    const newExpiresAt = addDays(REFRESH_EXPIRES_DAYS);

    await AuthService.rotateSession(
        session.session_id,
        newTokenId,
        newHash,
        req.ip || "",
        req.get("User-Agent") || "unknown",
        newExpiresAt
    );

    const user = await AuthService.findUserById(session.user_id);
    if (!user) throw new ApiError(HTTP_RESPONSE_CODE.NOT_FOUND, "User not found");

    const newAccessToken = signAccessToken({
        sub: user.user_id,
        role: user.user_role_id,
        token_id: newTokenId
    });

    res.status(HTTP_RESPONSE_CODE.SUCCESS).json(
        new ApiResponse(
            {
                access_token: newAccessToken,
                refresh_token: `${newTokenId}.${newSecret}`,
                token_type: "bearer",
                expires_in: 15 * 60
            },
            "Token refreshed successfully"
        )
    );
}

export async function logout(req: Request, res: Response) {
    const { refresh_token } = req.body;
    if (!refresh_token) throw new ApiError(HTTP_RESPONSE_CODE.BAD_REQUEST, "Missing refresh_token");

    const parts = refresh_token.split(".");
    if (parts.length !== 2) throw new ApiError(HTTP_RESPONSE_CODE.BAD_REQUEST, "Malformed token");
    const [tokenId] = parts;

    await AuthService.revokeSessionByTokenId(tokenId);
    res.status(HTTP_RESPONSE_CODE.SUCCESS).json(new ApiResponse({}, "Logged out successfully"));
}
