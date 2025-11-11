import pino from "pino";

const logger = pino({
    level: "info",
    transport: {
        targets: [
            // Target 1: Pretty print to the console (for development)
            {
                target: "pino-pretty",
                options: {
                    colorize: true,
                    translateTime: "SYS:dd-mm-yyyy HH:MM:ss",
                    ignore: "pid,hostname",
                },
            },
            // Target 2: Write to a file
            {
                level: "error", // Only log errors and above to this file
                target: "pino/file",
                options: { destination: "./app-errors.log" },
            },
        ],
    },
});

export default logger;
