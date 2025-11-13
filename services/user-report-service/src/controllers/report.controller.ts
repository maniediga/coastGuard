import type { Request, Response } from "express";
import { pool } from "../db.js";
import { publishUserReport } from "../rabbitmq.js";
import { apiResponse } from "../utils/api.response.js";
import { logger } from "../utils/logger.js";
import { ApiError } from "../utils/api.error.js";


// create report handler
export async function createReportHandler(req: Request, res: Response) {
  const userIdHeader = req.header("x-user-id");
  if (!userIdHeader) throw new ApiError(401, "User not authenticated", "AUTH_REQUIRED");
  const user_id = Number(userIdHeader);
  const text = req.body.text || null;
  const type_id = req.body.type_id ? Number(req.body.type_id) : null;
  const lat = Number(req.body.latitude);
  const lon = Number(req.body.longitude);

  if (!text && (!req.files || (req.files as Express.Multer.File[]).length === 0)) {
    throw new ApiError(400, "Either 'text' or 'media' must be provided", "BAD_REQUEST");
  }
  if (isNaN(lat) || isNaN(lon)) {
    throw new ApiError(400, "latitude and longitude are required", "BAD_REQUEST");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const insertReportText = `
      INSERT INTO hazard_reports(user_id, type_id, description, location, location_name, status_id, report_time, created_at)
      VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326), $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING report_id, report_time
    `;
    const defaultStatusId = 3;
    const location_name = req.body.location_name || null;
    const r = await client.query(insertReportText, [user_id, type_id, text, lon, lat, location_name, defaultStatusId]);
    const report_id = r.rows[0].report_id;
    const report_time = r.rows[0].report_time;

    const files = (req.files as Express.Multer.File[]) || [];
    let mediaUrls: string[] = [];
    if (files.length) {
      for (const file of files) {
        const mediaUrl = `/uploads/${file.filename}`;
        const insertMedia = `INSERT INTO report_media(report_id, media_url, media_type) VALUES ($1, $2, $3) RETURNING media_id`;
        const mt = file.mimetype;
        await client.query(insertMedia, [report_id, mediaUrl, mt]);
        mediaUrls.push(mediaUrl);
      }
    }

    await client.query("COMMIT");

    const message = {
      type: "user-report",
      payload: {
        report_id,
        user_id,
        type_id,
        text,
        location: { lat, lon },
        location_name,
        media: mediaUrls,
        status_id: defaultStatusId,
        report_time
      }
    };
    await publishUserReport(message);

    logger.info("Report created", { report_id, user_id });
    return res.status(201).json(apiResponse(true, "Report submitted", { report_id, media: mediaUrls }));
  } catch (err) {
    await client.query("ROLLBACK");
    logger.error("Error creating report", { err });
    throw err;
  } finally {
    client.release();
  }
}

// GET /reports
export async function getReportsHandler(req: Request, res: Response) {
  const lat = req.query.lat ? Number(req.query.lat) : null;
  const lon = req.query.lon ? Number(req.query.lon) : null;
  const radius_km = req.query.radius_km ? Number(req.query.radius_km) : null;
  const status = req.query.status ? String(req.query.status) : null;
  // default type_id = 1 (adjust if you have specific mapping in hazard_types)
const type_id = req.body.type_id ? Number(req.body.type_id) : 1;
 let limit = req.query.limit ? Math.min(Number(req.query.limit), 50) : 50;

  const params: any[] = [];
  let whereClauses: string[] = ["is_deleted = false"];
  if (!isNaN(Number(type_id))) {
    params.push(type_id);
    whereClauses.push(`hazard_reports.type_id = $${params.length}`);
  }
  if (status) {
    if (!isNaN(Number(status))) {
      params.push(Number(status));
      whereClauses.push(`hazard_reports.status_id = $${params.length}`);
    } else {
      whereClauses.push(`report_statuses.status_name ILIKE $${params.length + 1}`);
      params.push(`%${status}%`);
    }
  }

  let radiusClause = "";
  if (!isNaN(Number(lat)) && !isNaN(Number(lon)) && !isNaN(Number(radius_km))) {
    params.push(Number(lon || 0), Number(lat || 0), Number(radius_km || 0) * 1000);

    const idx = params.length - 2;
    radiusClause = `AND ST_DWithin(hazard_reports.location::geography, ST_SetSRID(ST_MakePoint($${idx}, $${idx+1}),4326)::geography, $${idx+2})`;
  }

  const baseQuery = `
    SELECT
      hazard_reports.*,
      hazard_types.type_name,
      report_statuses.status_name,
      COALESCE(array_agg(report_media.media_url) FILTER (WHERE report_media.media_url IS NOT NULL), '{}') as media_urls
    FROM hazard_reports
    LEFT JOIN hazard_types ON hazard_reports.type_id = hazard_types.type_id
    LEFT JOIN report_statuses ON hazard_reports.status_id = report_statuses.status_id
    LEFT JOIN report_media ON hazard_reports.report_id = report_media.report_id
    WHERE ${whereClauses.join(" AND ")} ${radiusClause}
    GROUP BY hazard_reports.report_id, hazard_types.type_name, report_statuses.status_name
    ORDER BY hazard_reports.report_time DESC
    LIMIT $${params.length + 1}
  `;
  params.push(limit);
  const { rows } = await pool.query(baseQuery, params);
  return res.json(apiResponse(true, "Reports fetched", rows));
}

// GET /reports/mine
export async function getMyReportsHandler(req: Request, res: Response) {
  const userIdHeader = req.header("x-user-id");
  if (!userIdHeader) throw new ApiError(401, "User not authenticated", "AUTH_REQUIRED");
  const user_id = Number(userIdHeader);
  const lat = req.query.lat ? Number(req.query.lat) : null;
  const lon = req.query.lon ? Number(req.query.lon) : null;
  const radius_km = req.query.radius_km ? Number(req.query.radius_km) : null;
  const status = req.query.status ? String(req.query.status) : null;
  const type_id = req.query.type_id ? Number(req.query.type_id) : null;
  let limit = req.query.limit ? Math.min(Number(req.query.limit), 50) : 50;

  const params: any[] = [user_id];
  let whereClauses: string[] = ["hazard_reports.is_deleted = false", `hazard_reports.user_id = $1`];

  if (!isNaN(Number(type_id))) {
    params.push(type_id);
    whereClauses.push(`hazard_reports.type_id = $${params.length}`);
  }
  if (status) {
    if (!isNaN(Number(status))) {
      params.push(Number(status));
      whereClauses.push(`hazard_reports.status_id = $${params.length}`);
    } else {
      params.push(`%${status}%`);
      whereClauses.push(`report_statuses.status_name ILIKE $${params.length}`);
    }
  }

  let radiusClause = "";
  if (!isNaN(Number(lat)) && !isNaN(Number(lon)) && !isNaN(Number(radius_km))) {
    params.push(Number(lon || 0), Number(lat || 0), Number(radius_km || 0) * 1000);

    const idx = params.length - 2;
    radiusClause = `AND ST_DWithin(hazard_reports.location::geography, ST_SetSRID(ST_MakePoint($${idx}, $${idx+1}),4326)::geography, $${idx+2})`;
  }

  const baseQuery = `
    SELECT
      hazard_reports.*,
      hazard_types.type_name,
      report_statuses.status_name,
      COALESCE(array_agg(report_media.media_url) FILTER (WHERE report_media.media_url IS NOT NULL), '{}') as media_urls
    FROM hazard_reports
    LEFT JOIN hazard_types ON hazard_reports.type_id = hazard_types.type_id
    LEFT JOIN report_statuses ON hazard_reports.status_id = report_statuses.status_id
    LEFT JOIN report_media ON hazard_reports.report_id = report_media.report_id
    WHERE ${whereClauses.join(" AND ")} ${radiusClause}
    GROUP BY hazard_reports.report_id, hazard_types.type_name, report_statuses.status_name
    ORDER BY hazard_reports.report_time DESC
    LIMIT $${params.length + 1}
  `;
  params.push(limit);
  const { rows } = await pool.query(baseQuery, params);
  return res.json(apiResponse(true, "User reports fetched", rows));
}
