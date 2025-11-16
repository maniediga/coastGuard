import { Request, Response } from "express";
import { query } from "../db.js";

export async function getPosts(req: Request, res: Response) {
    try {
        const keyword = req.query.keyword ? String(req.query.keyword) : null;
        const platform = req.query.platform ? String(req.query.platform) : null;
        const sentiment = req.query.sentiment ? String(req.query.sentiment) : null;

        const limit = req.query.limit ? Math.min(Number(req.query.limit), 50) : 10;
        const page = req.query.page ? Math.max(Number(req.query.page), 1) : 1;
        const sort = req.query.sort === "asc" ? "ASC" : "DESC";
        const offset = (page - 1) * limit;

        const lat = req.query.lat ? Number(req.query.lat) : null;
        const lon = req.query.lon ? Number(req.query.lon) : null;
        const radius = req.query.radius ? Number(req.query.radius) : null; // km

        let params: any[] = [];
        let sql = `
            SELECT 
                smp.post_id,
                smp.content,
                smp.author_name,
                smp.location_name,
                smp.post_time,
                smp.relevance_score,

                -- Extract lat/lon from geometry
                ST_Y(smp.location::geometry) AS latitude,
                ST_X(smp.location::geometry) AS longitude,

                p.platform_name AS platform,
                s.sentiment_name AS sentiment,
                m.media_url,

                -- Distance only if coordinates provided
                ${lat && lon
                ? `ST_DistanceSphere(
                                smp.location,
                                ST_SetSRID(ST_MakePoint($1, $2), 4326)
                           ) / 1000 AS distance`
                : `NULL AS distance`
            }

            FROM social_media_posts smp
            LEFT JOIN social_media_platforms p ON smp.platform_id = p.platform_id
            LEFT JOIN sentiments s ON smp.sentiment_id = s.sentiment_id
            LEFT JOIN report_media m ON smp.media_id = m.media_id
            WHERE 1=1
        `;

        if (lat && lon) {
            params.push(lon, lat);  // Note: ST_MakePoint(lon, lat)
        }

        // Keyword filter
        if (keyword) {
            params.push(`%${keyword}%`);
            sql += ` AND smp.content ILIKE $${params.length}`;
        }

        // Platform filter (by name)
        if (platform) {
            params.push(platform);
            sql += ` AND p.platform_name = $${params.length}`;
        }

        // Sentiment filter (by name)
        if (sentiment) {
            params.push(sentiment);
            sql += ` AND s.sentiment_name = $${params.length}`;
        }

        // Radius filter using PostGIS
        if (lat && lon && radius) {
            params.push(radius * 1000); // convert km → meters
            sql += ` AND ST_DWithin(
                        smp.location::geography,
                        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
                        $${params.length}
                    )`;
        }

        // Sorting + pagination
        params.push(limit, offset);
        sql += `
            ORDER BY smp.created_at ${sort}
            LIMIT $${params.length - 1}
            OFFSET $${params.length}
        `;

        const rows = await query(sql, params);

        res.json({
            success: true,
            page,
            limit,
            count: rows.length,
            data: rows
        });

    } catch (err) {
        console.error("Error fetching posts:", err);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}


export async function getPostById(req: Request, res: Response) {
    try {
        const id = Number(req.params.id);
        console.log("called for some reason");

        // Validate ID
        if (isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid post ID. ID must be a number.",
            });
        }

        const rows = await query(
            `  
            SELECT 
            smp.post_id,
            smp.content,
            smp.author_name,
            smp.location_name,
            smp.post_time,
            smp.relevance_score,

            -- Extract lat/lon from geometry
            ST_Y(smp.location::geometry) AS latitude,
            ST_X(smp.location::geometry) AS longitude,

            p.platform_name AS platform,
            s.sentiment_name AS sentiment,
            m.media_url

            FROM social_media_posts smp
            LEFT JOIN social_media_platforms p ON smp.platform_id = p.platform_id
            LEFT JOIN sentiments s ON smp.sentiment_id = s.sentiment_id
            LEFT JOIN report_media m ON smp.media_id = m.media_id
           WHERE post_id = $1`,
            [id]
        );

        if (rows.length === 0)
            return res.status(404).json({ success: false, message: "Post not found" });

        res.json({ success: true, data: rows[0] });
    } catch (err) {
        console.error("Error fetching post by ID:", err);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}
