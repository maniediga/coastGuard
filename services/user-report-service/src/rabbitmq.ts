import amqplib from "amqplib";
import { logger } from "./utils/logger.js";

const RABBIT_URL = process.env.RABBIT_URL || "amqp://localhost:5672";
const QUEUE_NAME = "reports";

let channel: amqplib.Channel | null = null;

export async function connectRabbitMQ() {
  try {
    const connection = await amqplib.connect(RABBIT_URL);
    channel = await connection.createChannel();
    await channel.assertQueue(QUEUE_NAME, { durable: true });
    logger.info(`✅ Connected to RabbitMQ and queue '${QUEUE_NAME}' is ready`);
  } catch (err) {
    logger.error("❌ RabbitMQ connection failed", err);
    throw err;
  }
}

export async function publishUserReport(message: any) {
  if (!channel) await connectRabbitMQ();
  const msgBuffer = Buffer.from(JSON.stringify(message));
  channel!.sendToQueue(QUEUE_NAME, msgBuffer);
  logger.info(`📨 Message sent to queue '${QUEUE_NAME}'`);
}
