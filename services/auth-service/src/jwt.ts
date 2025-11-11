import type { Algorithm, Secret, SignOptions } from "jsonwebtoken";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

function getKeys(): { privateKey: Secret; publicKey: Secret; algo: Algorithm } {
    const algo = (process.env.JWT_ALGO || "RS256") as Algorithm;
    if (algo.startsWith("RS")) {
        return {
            privateKey: process.env.PRIVATE_KEY || "private-key",
            publicKey: process.env.PUBLIC_KEY || "public-key",
            algo
        };
    }
    const secret = process.env.JWT_SECRET || "supersecret";
    return { privateKey: secret, publicKey: secret, algo };
}

const { privateKey, publicKey, algo } = getKeys();

export function signAccessToken(payload: object): string {
    const options: SignOptions = {
        algorithm: algo,
        expiresIn: process.env.ACCESS_TOKEN_EXPIRES || "15m" as any
    }
    return jwt.sign(payload, privateKey, options);
}

export function verifyAccessToken(token: string): any {
    return jwt.verify(token, publicKey, { algorithms: [algo] });
}
