import { HTTP_RESPONSE_CODE } from "../constanst/api.response.codes.js";
import { ApiError } from "../utils/api.error.js";
import jwt from "jsonwebtoken";

export function authMiddleware(req: any, res: any, next: any) {
    //  Get the token from the Authorization header
    const authHeader = req.headers['authorization'];

    //  Extract the token from the "Bearer <token>" string
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        // Use 'return next()' for async errors, or just throw if your framework handles it
        throw new ApiError(HTTP_RESPONSE_CODE.UNAUTHORIZED, "No token provided, authorization denied");
    }

    //  Verify the token
    jwt.verify(token, process.env.JWT_SECRET || "", (err: any, decoded: any) => {
        if (err) {
            // Use 'return next(err)' or throw if your framework handles it
            throw new ApiError(HTTP_RESPONSE_CODE.UNAUTHORIZED, "Invalid token");
        }

        //  Attach user payload to the request object
        req.userId = decoded.sub;
        req.userName = decoded.user_name;
        req.role = decoded.role;

        next();
    });
}

export default authMiddleware;
