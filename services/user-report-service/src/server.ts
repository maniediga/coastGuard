import express from "express";
import cors from "cors";
import multer from "multer";
import { connectRabbitMQ } from "./rabbitmq.js";
import authMiddleware from "./middlewares/auth.middleware.js";

// handle global exceptions early
process.on("uncaughtException", (err) => {
    console.error("Uncaught Exception:", err);
});

process.on("unhandledRejection", (reason) => {
    console.error("Unhandled Rejection:", reason);
});

async function bootstrap() {
    try {
        // dynamic import of controllers
        const controller = await import("./controllers/report.controller.ts");
        const createReportHandler = controller.createReportHandler;
        const getReportsHandler = controller.getReportsHandler;
        const getMyReportsHandler = controller.getMyReportsHandler;

        // connect to RabbitMQ
        await connectRabbitMQ();

        const app = express();
        app.use(cors());
        app.use(express.json());

        const upload = multer({ dest: "uploads/" });

        // routes
        app.post("/api/v1/reports", authMiddleware, upload.array("media"), createReportHandler);
        app.get("/api/v1/reports", authMiddleware, getReportsHandler);
        app.get("/api/v1/reports/mine", authMiddleware, getMyReportsHandler);

        const PORT = process.env.PORT || 4003;
        app.listen(PORT, () => {
            console.log(`[INFO] user-report-service listening on port ${PORT}`);
        });
    } catch (err) {
        console.error("Failed to start server:", err);
        process.exit(1);
    }
}

// start everything
bootstrap();
