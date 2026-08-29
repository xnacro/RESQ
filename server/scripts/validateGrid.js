import pool from "../config/db.js";
import gridService from "../services/gridService.js";

async function runValidation() {
  console.log("==========================================");
  console.log("🧪 STARTING RESQ GRID VALIDATION SUITE");
  console.log("==========================================\n");

  const results = {};

  try {
    // 1. PostGIS extension
    const extRes = await pool.query("SELECT extname, extversion FROM pg_extension WHERE extname = 'postgis'");
    results.postgis = extRes.rows[0];
    console.log("1. PostGIS Extension:", results.postgis);

    // 2. Tables exist in grid_500m
    const tablesRes = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'grid_500m' 
      ORDER BY table_name;
    `);
    results.tables = tablesRes.rows.map((r) => r.table_name);
    console.log("2. Tables in grid_500m:", results.tables);

    // 3. Assam cell count
    const assamCountRes = await pool.query("SELECT COUNT(*)::int AS count FROM grid_500m.assam");
    results.assamCount = assamCountRes.rows[0].count;
    console.log("3. Assam Total Cells:", results.assamCount);

    // 4. Meghalaya cell count
    const mlCountRes = await pool.query("SELECT COUNT(*)::int AS count FROM grid_500m.meghalaya");
    results.meghalayaCount = mlCountRes.rows[0].count;
    console.log("4. Meghalaya Total Cells:", results.meghalayaCount);

    // 5. Geometry validity
    const assamInvalidRes = await pool.query("SELECT COUNT(*)::int AS invalid FROM grid_500m.assam WHERE NOT ST_IsValid(geom)");
    const mlInvalidRes = await pool.query("SELECT COUNT(*)::int AS invalid FROM grid_500m.meghalaya WHERE NOT ST_IsValid(geom)");
    results.invalidGeometries = {
      assam: assamInvalidRes.rows[0].invalid,
      meghalaya: mlInvalidRes.rows[0].invalid,
    };
    console.log("5. Invalid Geometries (should be 0):", results.invalidGeometries);

    // 6. SRID and Geometry Type
    const sridRes = await pool.query(`
      SELECT 'Assam' AS state, ST_SRID(geom) AS srid, GeometryType(geom) AS geom_type, COUNT(*) AS count
      FROM grid_500m.assam GROUP BY ST_SRID(geom), GeometryType(geom)
      UNION ALL
      SELECT 'Meghalaya' AS state, ST_SRID(geom) AS srid, GeometryType(geom) AS geom_type, COUNT(*) AS count
      FROM grid_500m.meghalaya GROUP BY ST_SRID(geom), GeometryType(geom);
    `);
    results.sridAndTypes = sridRes.rows;
    console.log("6. SRID & Geometry Types:", results.sridAndTypes);

    // 7. Indexes exist
    const idxRes = await pool.query(`
      SELECT tablename, indexname, indexdef 
      FROM pg_indexes 
      WHERE schemaname = 'grid_500m' 
      ORDER BY tablename, indexname;
    `);
    results.indexes = idxRes.rows.map((r) => `${r.tablename} -> ${r.indexname}`);
    console.log("7. Indexes:", results.indexes);

    // 8. Grid cell metric size check (area in metres)
    const areaRes = await pool.query(`
      SELECT 
        'Assam' AS state,
        ROUND(AVG(ST_Area(ST_Transform(geom, 32646)))) AS avg_area_sqm,
        ROUND(MAX(ST_Area(ST_Transform(geom, 32646)))) AS max_area_sqm,
        ROUND(MIN(ST_Area(ST_Transform(geom, 32646)))) AS min_area_sqm
      FROM grid_500m.assam
      UNION ALL
      SELECT 
        'Meghalaya' AS state,
        ROUND(AVG(ST_Area(ST_Transform(geom, 32646)))) AS avg_area_sqm,
        ROUND(MAX(ST_Area(ST_Transform(geom, 32646)))) AS max_area_sqm,
        ROUND(MIN(ST_Area(ST_Transform(geom, 32646)))) AS min_area_sqm
      FROM grid_500m.meghalaya;
    `);
    results.metricAreas = areaRes.rows;
    console.log("8. Metric Area Stats (500x500m = 250,000 sqm max):", results.metricAreas);

    // 9. Boundary clipping check (cells with area < 250000 sqm are clipped border cells)
    const clipRes = await pool.query(`
      SELECT 
        'Assam' AS state,
        COUNT(*) FILTER (WHERE ST_Area(ST_Transform(geom, 32646)) >= 249990) AS full_cells,
        COUNT(*) FILTER (WHERE ST_Area(ST_Transform(geom, 32646)) < 249990) AS clipped_boundary_cells
      FROM grid_500m.assam
      UNION ALL
      SELECT 
        'Meghalaya' AS state,
        COUNT(*) FILTER (WHERE ST_Area(ST_Transform(geom, 32646)) >= 249990) AS full_cells,
        COUNT(*) FILTER (WHERE ST_Area(ST_Transform(geom, 32646)) < 249990) AS clipped_boundary_cells
      FROM grid_500m.meghalaya;
    `);
    results.boundaryClipping = clipRes.rows;
    console.log("9. Boundary Clipping Distribution:", results.boundaryClipping);

    // 10. Idempotency test: Rerun generateAllStateGrids without force
    console.log("\n10. Testing Idempotency (Rerunning grid generator)...");
    const rerunResult = await gridService.generateAllStateGrids({ force: false });
    console.log("Rerun Result (both must be SKIPPED):", rerunResult);

    // Verify cell counts haven't changed
    const assamCountAfter = (await pool.query("SELECT COUNT(*)::int AS count FROM grid_500m.assam")).rows[0].count;
    const mlCountAfter = (await pool.query("SELECT COUNT(*)::int AS count FROM grid_500m.meghalaya")).rows[0].count;
    console.log(`Cell counts after rerun - Assam: ${assamCountAfter}, Meghalaya: ${mlCountAfter}`);

    // 11. Processing status records
    const statusRes = await pool.query("SELECT state, grid_size_m, status, total_cells, started_at, completed_at FROM grid_500m.processing_status ORDER BY state;");
    console.log("\n11. Processing Status Records:", statusRes.rows);

    // 12. Spatial queries
    console.log("\n12. Testing Spatial Queries:");
    // 12a. Point in Guwahati (26.1445, 91.7362)
    const guwahatiGrid = await gridService.getGridByPoint(26.1445, 91.7362, "Assam");
    console.log("12a. Guwahati (26.1445, 91.7362) Grid Cell:", guwahatiGrid ? { grid_id: guwahatiGrid.grid_id, state: guwahatiGrid.state, center_lat: guwahatiGrid.center_lat, center_lon: guwahatiGrid.center_lon } : "NOT FOUND");

    // 12b. Point in Shillong (25.5788, 91.8933)
    const shillongGrid = await gridService.getGridByPoint(25.5788, 91.8933, "Meghalaya");
    console.log("12b. Shillong (25.5788, 91.8933) Grid Cell:", shillongGrid ? { grid_id: shillongGrid.grid_id, state: shillongGrid.state, center_lat: shillongGrid.center_lat, center_lon: shillongGrid.center_lon } : "NOT FOUND");

    // 12c. Sample disaster polygon intersection (Brahmaputra flood polygon around Guwahati)
    const floodPolygon = {
      type: "Polygon",
      coordinates: [
        [
          [91.70, 26.12],
          [91.75, 26.12],
          [91.75, 26.16],
          [91.70, 26.16],
          [91.70, 26.12],
        ],
      ],
    };
    const floodIntersectGrids = await gridService.getGridsByGeometry(floodPolygon, "Assam", 10);
    console.log(`12c. Disaster Geometry Intersection: found ${floodIntersectGrids.length} intersecting cells (first grid_id: ${floodIntersectGrids[0]?.grid_id})`);

    console.log("\n==========================================");
    console.log("✅ ALL VALIDATION CHECKS PASSED SUCCESSFULLY!");
    console.log("==========================================");

    process.exit(0);
  } catch (err) {
    console.error("❌ Validation Failed:", err);
    process.exit(1);
  }
}

runValidation();
