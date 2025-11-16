import { pool } from "../db.js";

export async function saveHazardReport(msg: any) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        // 1) Lookup hazard_type_id
        const hazardQ = `SELECT type_id FROM hazard_types WHERE type_name = $1`;
        const hazardRes = await client.query(hazardQ, [msg.hazard_type]);
        if (hazardRes.rowCount === 0) {
            throw new Error(`Unknown hazard_type: ${msg.hazard_type}`);
        }
        const hazard_type_id = hazardRes.rows[0].type_id;

        // 2) Lookup sentiment_id
        const sentQ = `SELECT sentiment_id FROM sentiments WHERE sentiment_name = $1`;
        const sentRes = await client.query(sentQ, [msg.sentiment]);
        if (sentRes.rowCount === 0) {
            throw new Error(`Unknown sentiment: ${msg.sentiment}`);
        }
        const sentiment_id = sentRes.rows[0].sentiment_id;

        // 3) Find or create media_id (reuse by media_url if exists)
        let media_id: number | null = null;
        if (msg.media_url && msg.media_url.length > 0) {
            const mediaInsQ = `INSERT INTO report_media (media_url, media_type) VALUES ($1, $2) RETURNING media_id`;
            const mediaInsRes = await client.query(mediaInsQ, [msg.media_url, msg.media_type]);
            media_id = mediaInsRes.rows[0].media_id;
        }

        // 4) Insert into hazard_reports
        const insertQ = `
      INSERT INTO hazard_reports
        (user_id, hazard_type_id, description, location, location_name,
         sentiment_id, relevance_score, report_time, media_id, status_id)
      VALUES
        ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326), $6, $7, $8, $9::timestamptz, $10, $11)
      RETURNING report_id
    `;
        const params = [
            msg.user_id,            // $1
            hazard_type_id,         // $2
            msg.text,               // $3
            msg.location.lon,       // $4 (lon)
            msg.location.lat,       // $5 (lat)
            msg.location.name,      // $6
            sentiment_id,           // $7
            msg.relevance_score,    // $8
            msg.report_time,        // $9
            media_id,               // $10 (nullable)
            1                       // $11 default status_id
        ];

        const insertRes = await client.query(insertQ, params);

        await client.query("COMMIT");
        return insertRes.rows[0]; // { report_id: ... }

    } catch (err) {
        await client.query("ROLLBACK");
        console.error("saveHazardReport error:", err);
        throw err;
    } finally {
        client.release();
    }
}
