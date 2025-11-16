import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { Express } from "express";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

export function setupSwagger(app: Express) {
    //  FIX for __dirname in ES Modules
    const __dirname = path.dirname(fileURLToPath(import.meta.url));

    const routesPath = path.join(__dirname, "routes", "*.js");
    const controllersPath = path.join(__dirname, "controllers", "*.js");

    console.log("🔍 Swagger looking in:");
    console.log("Routes:", routesPath);
    console.log("Controllers:", controllersPath);
    console.log("Routes folder exists:", fs.existsSync(path.dirname(routesPath)));
    console.log("Controllers folder exists:", fs.existsSync(path.dirname(controllersPath)));

    const options = {
        definition: {
            openapi: "3.0.0",
            info: {
                title: "Social Posts Service API",
                version: "1.0.0",
            },
        },
        apis: [routesPath, controllersPath],
    };

    const spec = swaggerJsdoc(options);
    app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(spec));
}
