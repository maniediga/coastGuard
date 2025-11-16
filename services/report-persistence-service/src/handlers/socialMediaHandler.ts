import { pool } from "../db.js";

export async function saveSocialMediaPost(msg: any) {
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

        // 3) Lookup platform_id
        const platQ = `SELECT platform_id FROM social_media_platforms WHERE platform_name = $1`;
        const platRes = await client.query(platQ, [msg.platform]);
        if (platRes.rowCount === 0) {
            throw new Error(`Unknown platform: ${msg.platform}`);
        }
        const platform_id = platRes.rows[0].platform_id;

        // 4) Find or create media_id (reuse by media_url if exists)
        let media_id: number | null = null;
        if (msg.media_url && msg.media_url.length > 0) {
            const mediaInsQ = `INSERT INTO report_media (media_url, media_type) VALUES ($1, $2) RETURNING media_id`;
            const mediaInsRes = await client.query(mediaInsQ, [msg.media_url, msg.media_type]);
            media_id = mediaInsRes.rows[0].media_id;
        }

        // 5) Insert into social_media_posts
        const insertQ = `
      INSERT INTO social_media_posts
        (platform_id, author_name, content, location_name, location,
         hazard_type_id, sentiment_id, relevance_score, post_time, media_id, status_id)
      VALUES
        ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326), $7, $8, $9, $10::timestamptz, $11, $12)
      RETURNING post_id
    `;
        const params = [
            platform_id,            // $1
            msg.user_name,          // $2
            msg.text,               // $3
            msg.location.name,      // $4
            msg.location.lon,       // $5
            msg.location.lat,       // $6
            hazard_type_id,         // $7
            sentiment_id,           // $8
            msg.relevance_score,    // $9
            msg.report_time,        // $10
            media_id,               // $11 (nullable)
            1                       // $12 default status_id
        ];

        const insertRes = await client.query(insertQ, params);

        await client.query("COMMIT");
        return insertRes.rows[0]; // { post_id: ... }

    } catch (err) {
        await client.query("ROLLBACK");
        console.error("saveSocialMediaPost error:", err);
        throw err;
    } finally {
        client.release();
    }
}
