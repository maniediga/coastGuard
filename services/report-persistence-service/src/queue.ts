import amqplib from "amqplib";
import { saveHazardReport } from "./handlers/hazardReportHandler.js";
import { saveSocialMediaPost } from "./handlers/socialMediaHandler.js";

export async function startQueueConsumer() {
    const conn = await amqplib.connect(process.env.RABBITMQ_URL!);
    const channel = await conn.createChannel();

    const queue = "processed_reports";
    await channel.assertQueue(queue, { durable: true });

    console.log("Listening on queue:", queue);

    channel.consume(queue, async (msg: any) => {
        if (!msg) return;

        try {
            const data = JSON.parse(msg.content.toString());

            if (data.platform === "coastGuard") {
                const report_id = await saveHazardReport(data);
                console.log(report_id);
            } else {
                const report_id = await saveSocialMediaPost(data);
                console.log(report_id);
            }

            channel.ack(msg);

        } catch (err) {
            console.error("Failed message:", err);
            channel.nack(msg, false, false);
        }
    });
}
