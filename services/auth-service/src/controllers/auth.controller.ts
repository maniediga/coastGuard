import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import * as authServices from "../services/auth.services.js";
import { ApiResponse } from "../utils/api.response.js";
import { ApiError } from "../utils/api.error.js";
import { HTTP_RESPONSE_CODE } from "../constants/api.response.codes.js";

const saltRounds = 12;

export async function register(req: any, res: any) {
    const { userName, email, password, phone } = req.body;

    // encrypt the password
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const userEmailExists = await authServices.findUserByEmail(email);
    if (userEmailExists) {
        throw new ApiError(HTTP_RESPONSE_CODE.CONFLICT, "user already registered, login in instead");
    }
    const userNameTaken = await authServices.findUserByUserName(userName);
    if (userNameTaken) {
        throw new ApiError(HTTP_RESPONSE_CODE.CONFLICT, "userName taken, try something else.");
    }

    const user = await authServices.createUser(userName, email, hashedPassword, phone);

    const payload = { user_id: user.user_id, user_name: user.user_name, role: user.user_role_id }

    const token = jwt.sign(payload, process.env.JWT_SECRET || "super-secret", {
        expiresIn: "30d", // tokens expires after longer time if remember me option is selected
    });

    res.status(HTTP_RESPONSE_CODE.CREATED)
        .json(
            new ApiResponse({ token: token, userName: user.user_name }, "User registered successfuly"),
        );
}

export async function login(req: any, res: any) {
    const { userEmail, password } = req.body;

    const user = await authServices.findUserByEmail(userEmail);
    if (!user) {
        // returning both wrong username or password to avoid leaking email to unauthorized users
        throw new ApiError(HTTP_RESPONSE_CODE.UNAUTHORIZED, "Wrong Email or password");
    }

    const isPasswordValid = await bcrypt.compare(password, user.hashed_password || "");
    if (!isPasswordValid) {
        throw new ApiError(HTTP_RESPONSE_CODE.UNAUTHORIZED, "Wrong Email or password");
    }

    const payload = { user_id: user.user_id, user_name: user.user_name, role: user.user_role_id }

    const token = jwt.sign(payload, process.env.JWT_SECRET || "super-secret", {
        expiresIn: "30d", // tokens expires after longer time if remember me option is selected
    });

    res.status(HTTP_RESPONSE_CODE.CREATED)
        .json(
            new ApiResponse({ token: token, userName: user.user_name }, "User Logged in successfuly"),
        );
}

/*
export async function logout(req: any, res: any) {
    // must pass the same options (path, domain) that were used to set the cookie.
    // Since we only used the defaults, we just need httpOnly, secure, and sameSite.
    const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
    };

    // clearCookie method handles the expiration logic
    res.clearCookie("jwt_token", cookieOptions)
        .status(HTTP_RESPONSE_CODE.SUCCESS)
        .json(new ApiResponse({}, "User logged out successfully"));
}
*/

/*
export async function sendLinkForEmailVerification(req, res) {
    const userId = req.userId;

    const user = await getUserById(userId);
    // should never happend unless user was deleted for some reason or server crashed
    if (!user) {
        throw new ApiError(HTTP_RESPONSE_CODE.SERVER_ERROR, "User not found");
    }

    const verificationToken = crypto.randomUUID();
    // set 30 minutes expiration time
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    const userTokens = await authServices.getUserTokens(userId);
    let validTokenCount = 0;

    for (const userToken of userTokens) {
        if (userToken.expiresAt > new Date()) {
            validTokenCount++;
        }
    }

    if (validTokenCount >= 2)
        throw new ApiError(
            HTTP_RESPONSE_CODE.BAD_REQUEST,
            "Two valid links already sent for verification, kindly use one of those or try again later",
        );

    const dbToken = await authServices.addUserEmailVerificationToken(userId, verificationToken, expiresAt);
    if (!dbToken)
        throw new ApiError(HTTP_RESPONSE_CODE.SERVER_ERROR, "Couldn't send token due to server error, try again later.");

    // Use your email service to send the verification email
    const verificationLink = `http://localhost:5173/verify-email/${verificationToken}`;

    const emailStatus = await sendEmail({
        to: user.name,
        subject: "Verify Your Orbit Account",
        html: `
      <h1>Welcome to Orbit!</h1>
      <p>Please click the link below to verify your email address:</p>
      <a href="${verificationLink}">Verify My Email</a>
      <p>The above link is only valid for 30 minutes</p>
    `,
    });

    if (emailStatus.success) {
        res.status(HTTP_RESPONSE_CODE.SUCCESS).json(
            new ApiResponse(HTTP_RESPONSE_CODE.SUCCESS, {}, "Verification Link Sent please check the email"),
        );
    } else {
        res.status(HTTP_RESPONSE_CODE.SERVER_ERROR, "Couldn't send token due to issues with mailing service");
    }
}

export async function verifyEmail(req, res) {
    const userId = req.userId;
    const { token } = req.params;

    const user = await getUserById(userId);
    if (user.isVerified)
        return res
            .status(HTTP_RESPONSE_CODE.SUCCESS)
            .json(new ApiResponse(HTTP_RESPONSE_CODE.SUCCESS, {}, "Email already verified!"));

    const verifyEmail = await authServices.verifyEmail(userId, token);

    if (!verifyEmail) throw new ApiError(HTTP_RESPONSE_CODE.UNAUTHORIZED, "Link is expired use a newer one");

    res.status(HTTP_RESPONSE_CODE.SUCCESS).json(new ApiResponse(HTTP_RESPONSE_CODE.SUCCESS, {}, "Email verified"));
}
*/
