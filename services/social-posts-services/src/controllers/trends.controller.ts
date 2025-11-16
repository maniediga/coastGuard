import { Request, Response } from "express";
import { query } from "../db.js";

export async function getTrends(req, res) {
    try {
        // 1️⃣ Sentiment counts
        const sentiments = await query(`
      SELECT 
        s.sentiment_name AS sentiment,
        COUNT(*) AS count
      FROM social_media_posts smp
      LEFT JOIN sentiments s ON smp.sentiment_id = s.sentiment_id
      GROUP BY s.sentiment_name
      ORDER BY count DESC
    `);

        // 2️⃣ Platform counts
        const platforms = await query(`
      SELECT 
        p.platform_name AS platform,
        COUNT(*) AS count
      FROM social_media_posts smp
      LEFT JOIN social_media_platforms p ON smp.platform_id = p.platform_id
      GROUP BY p.platform_name
      ORDER BY count DESC
    `);

        // 3️⃣ Top hashtags from content
        const hashtags = await query(`
      SELECT 
        unnest(regexp_matches(content, '#[A-Za-z0-9_]+', 'g')) AS hashtag
      FROM social_media_posts
    `);

        const tagCounts = {};
        hashtags.forEach((row) => {
            const tag = row.hashtag.toLowerCase();
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });

        const topHashtags = Object.entries(tagCounts)
            .map(([tag, count]) => ({ tag, count }))
            .sort((a, b) => Number(b.count) - Number(a.count));

        res.json({
            success: true,
            trends: {
                sentiments,
                platforms,
                topHashtags,
            },
        });

    } catch (err) {
        console.error("Error fetching trends:", err);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}
