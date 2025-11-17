import { query } from '../db';

// These are your clustering rules. You can tune them later.
const CLUSTER_DISTANCE_KM = 1.5; // (eps) 1.5km radius
const MIN_REPORTS_IN_CLUSTER = 5; // (minPoints) 5 reports to make a hotspot
const REPORT_TIME_HOURS = 48; // Look at reports from the last 48 hours

// PostGIS's ST_ClusterDBSCAN measures distance in the query's unit.
// Since our data is in 4326 (lat/lon), we must set `eps` in meters.
const CLUSTER_DISTANCE_METERS = CLUSTER_DISTANCE_KM * 1000;

export const updateHotspots = async () => {
  console.log('Running hotspot update job...');

  const clusteringQuery = `
    -- Step 4: Clear old hotspots and insert the new ones
    INSERT INTO hotspots (location, radius_km, intensity_score, dominant_hazard_type_id)
    
    -- Step 3: Group the clusters to find their center, size, and dominant type
    WITH final_clusters AS (
      SELECT
        cluster_id,
        COUNT(*) AS report_count,
        -- Find the geometric center (centroid) of all points in the cluster
        ST_Centroid(ST_Collect(location)) AS center_location,
        
        -- Find the most common hazard type in the cluster
        (SELECT type_id
         FROM (SELECT type_id, COUNT(*) AS type_count
               FROM all_reports_for_clustering r2
               WHERE r2.cluster_id = r.cluster_id AND r2.type_id IS NOT NULL
               GROUP BY type_id
               ORDER BY type_count DESC
               LIMIT 1) AS dominant_type
        ) AS dominant_hazard_type_id
      FROM all_reports_for_clustering r
      WHERE cluster_id IS NOT NULL -- Exclude "noise" points
      GROUP BY cluster_id
    )
    
    -- This is the final SELECT that gets inserted
    SELECT
      center_location,
      ${CLUSTER_DISTANCE_KM} AS radius_km,
      report_count AS intensity_score,
      dominant_hazard_type_id
    FROM final_clusters
    WHERE report_count >= ${MIN_REPORTS_IN_CLUSTER};

    -- Step 2: Run the DBSCAN clustering algorithm
    WITH all_reports_for_clustering AS (
      SELECT
        location,
        type_id,
        -- This is the magic function!
        -- It groups points by distance (eps) and min density (minpoints)
        ST_ClusterDBSCAN(
          location::geography, -- Cast to geography to use meters
          eps := ${CLUSTER_DISTANCE_METERS},
          minpoints := ${MIN_REPORTS_IN_CLUSTER}
        ) OVER () AS cluster_id
      FROM all_recent_reports
    )

    -- Step 1: Get all valid reports from both tables
    WITH all_recent_reports AS (
      (
        SELECT location, type_id
        FROM hazard_reports
        WHERE report_time > (NOW() - INTERVAL '${REPORT_TIME_HOURS} hours')
          AND status_id = (SELECT status_id FROM report_statuses WHERE status_name = 'Officially Verified')
          AND location IS NOT NULL
      )
      UNION ALL
      (
        SELECT location, NULL AS type_id -- We don't have a hazard_type for social posts
        FROM social_media_posts
        WHERE post_time > (NOW() - INTERVAL '${REPORT_TIME_HOURS} hours')
          AND relevance_score > 0.8 -- Only use high-confidence posts
          AND location IS NOT NULL
      )
    )

    -- We need to delete old hotspots before inserting new ones
    -- We do this using a "Common Table Expression" (CTE) trick
    , delete_old AS (
      DELETE FROM hotspots
    )
  `;

  try {
    const result = await query(clusteringQuery);
    console.log(`Hotspot job complete. ${result.rowCount} hotspots inserted.`);
  } catch (err) {
    console.error('Error running hotspot update job:', err);
  }
};

// This function is for the API, it just reads the table



export const getActiveHotspots = async () => {
  // OLD QUERY:
  // const { rows } = await query('SELECT * FROM hotspots');

  // NEW, BETTER QUERY:
  const getHotspotsQuery = `
    SELECT
      hotspot_id,
      ST_AsGeoJSON(location)::json AS location, -- This is the magic part
      radius_km,
      intensity_score,
      dominant_hazard_type_id,
      created_at,
      updated_at
    FROM hotspots;
  `;
  
  const { rows } = await query(getHotspotsQuery);
  return rows;
};