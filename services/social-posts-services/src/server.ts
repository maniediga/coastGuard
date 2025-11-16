import express from "express";
import postsRoutes from "./routes/posts.routes.js";
import { setupSwagger } from "./swagger.js";

const app = express();
app.use(express.json());

// Swagger MUST be initialized BEFORE routes
setupSwagger(app);

// Routes
app.use("/api/v1/social-posts", postsRoutes);

const PORT = 4010;
app.listen(PORT, () => {
    console.log(`[INFO] social-posts-service running at port ${PORT}`);
    console.log(`[INFO] Swagger UI: http://localhost:${PORT}/api-docs`);
});
