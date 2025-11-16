import { Request, Response } from "express";
import { query } from "../db.js";

export async function getNearbyPosts(req: Request, res: Response) {
    try {
        console.log("YAYAYYA");
        const lat = Number(req.query.lat);
        const lon = Number(req.query.lon);
        const radius_km = Number(req.query.radius) || 5;

        if (isNaN(lat) || isNaN(lon)) {
            return res.status(400).json({
                success: false,
                message: "Latitude and longitude must be valid numbers.",
            });
        }

        // Convert to meters for ST_DWithin
        const radius_m = radius_km * 1000;

        const sql = `
        SELECT
            smp.post_id,
            smp.author_name,
            smp.content,
            smp.location_name,

            -- Extract latitude/longitude from PostGIS point
            ST_Y(smp.location::geometry) AS latitude,
            ST_X(smp.location::geometry) AS longitude,

            p.platform_name AS platform,
            s.sentiment_name AS sentiment,
            m.media_url,

            -- Distance in KM
            (ST_DistanceSphere(
                smp.location,
                ST_SetSRID(ST_MakePoint($1, $2), 4326)
            ) / 1000)::numeric(10,2) AS distance_km

        FROM social_media_posts smp
        LEFT JOIN social_media_platforms p ON smp.platform_id = p.platform_id
        LEFT JOIN sentiments s ON smp.sentiment_id = s.sentiment_id
        LEFT JOIN report_media m ON smp.media_id = m.media_id

        WHERE 
            smp.location IS NOT NULL
            AND ST_DWithin(
                smp.location::geography,
                ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
                $3
            )

        ORDER BY distance_km ASC
        LIMIT 50;
        `;

        console.log("\n\nRUNNING SQL:\n", sql, "\n");

        const rows = await query(sql, [lon, lat, radius_m]);

        res.json({
            success: true,
            radius_km,
            count: rows.length,
            data: rows,
        });

    } catch (err) {
        console.error("Error fetching nearby posts:", err);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}
