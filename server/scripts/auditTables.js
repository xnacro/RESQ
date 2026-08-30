// Comprehensive Database and Schema Audit Script for Dynamic Disaster Risk System
import pool from "../config/db.js";

async function runAudit() {
  const tables = [
    ["grid_500m", "assam"],
    ["grid_500m", "meghalaya"],
    ["disaster", "news_events"],
    ["disaster", "event_grid_links"],
    ["disaster", "event_clusters"],
    ["disaster", "flood_events"],
    ["disaster", "landslide_events"],
    ["infrastructure", "roads"],
    ["infrastructure", "bridges"],
    ["environment", "waterbodies"],
    ["news", "rss_items"],
    ["news", "rss_sources"],
    ["datasets", "registry"],
  ];

  console.log("================================================================================");
  console.log("                  RESQ DATABASE & SCHEMA AUDIT REPORT                           ");
  console.log("================================================================================");

  for (const [schema, tbl] of tables) {
    try {
      const countRes = await pool.query(`SELECT count(*) FROM "${schema}"."${tbl}"`);
      const geomRes = await pool.query(
        `
        SELECT f_geometry_column, srid, type 
        FROM geometry_columns 
        WHERE f_table_schema = $1 AND f_table_name = $2;
      `,
        [schema, tbl]
      );

      const colsRes = await pool.query(
        `
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = $2
        ORDER BY ordinal_position;
      `,
        [schema, tbl]
      );

      const idxRes = await pool.query(
        `
        SELECT indexname, indexdef 
        FROM pg_indexes 
        WHERE schemaname = $1 AND tablename = $2;
      `,
        [schema, tbl]
      );

      console.log(`\n### ${schema}.${tbl}`);
      console.log(`- Row Count: ${countRes.rows[0].count}`);
      if (geomRes.rows.length > 0) {
        console.log(`- Geometry: column=${geomRes.rows[0].f_geometry_column}, SRID=${geomRes.rows[0].srid}, type=${geomRes.rows[0].type}`);
      } else {
        console.log(`- Geometry: NONE`);
      }
      console.log(`- Columns (${colsRes.rows.length}): ${colsRes.rows.map((c) => c.column_name).join(", ")}`);
      console.log(`- Indexes (${idxRes.rows.length}):`);
      for (const idx of idxRes.rows) {
        console.log(`    * ${idx.indexname} -> ${idx.indexdef}`);
      }
    } catch (err) {
      console.log(`\n### ${schema}.${tbl} -> ERROR: ${err.message}`);
    }
  }

  process.exit(0);
}

runAudit().catch((err) => {
  console.error("Audit script failed:", err);
  process.exit(1);
});
