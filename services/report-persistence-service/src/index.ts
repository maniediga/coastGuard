import dotenv from "dotenv";
dotenv.config();

import { startQueueConsumer } from "./queue.js";

async function main() {
    console.log("Report Creation Service starting...");
    await startQueueConsumer();
}

main();
