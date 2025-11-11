import express from "express";
import cookieParser from "cookie-parser";
import apiRouter from "./src/api/auth.routes.js";
import { HTTP_RESPONSE_CODE } from "./src/constants/api.response.codes.js";
import errorHandler from "./src/middlewares/error.middleware.js";

const app = express();
const PORT = 8080;

app.use(express.json());
app.use(cookieParser());

app.use("/api/v1/auth", apiRouter);

app.all("/{*splat}", function(req, res) {
    res.status(HTTP_RESPONSE_CODE.NOT_FOUND).send("Not found");
});

app.use(errorHandler);

app.listen(PORT, () => {
    console.log(`Server has started on port: ${PORT}`);
});
