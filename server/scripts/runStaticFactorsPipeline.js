// Pipeline script to compute and populate all 9 static factors on 500m grids
import pool from "../config/db.js";
import { populateAllStaticFactors } from "../services/datasets/staticFactorsService.js";
import { getAllDatasets } from "../services/datasets/datasetRegistryService.js";

async function run() {
  await populateAllStaticFactors();

  console.log("\n==========================================");
  console.log("📊 VALIDATING POPULATED STATIC GRID COLUMNS");
  console.log("==========================================\n");

  const assamStats = await pool.query(`
    SELECT 
      COUNT(*) AS total_cells,
      ROUND(AVG(elevation_mean)::numeric, 1) AS avg_elevation,
      ROUND(MIN(elevation_min)::numeric, 1) AS min_elevation,
      ROUND(MAX(elevation_max)::numeric, 1) AS max_elevation,
      ROUND(AVG(slope_mean)::numeric, 1) AS avg_slope,
      ROUND(AVG(distance_to_river)::numeric, 1) AS avg_river_dist,
      ROUND(AVG(waterbody_percentage)::numeric, 1) AS avg_water_pct,
      COUNT(*) FILTER (WHERE flood_susceptibility > 0) AS flood_vulnerable_cells,
      COUNT(*) FILTER (WHERE landslide_susceptibility > 0) AS landslide_vulnerable_cells,
      ROUND(AVG(population_density)::numeric, 1) AS avg_pop_density,
      ROUND(AVG(infrastructure_exposure)::numeric, 1) AS avg_infra_exposure,
      COUNT(*) FILTER (WHERE seismic_risk = 100) AS seismic_zone_v_cells
    FROM grid_500m.assam;
  `);

  console.log("📍 ASSAM 500m GRID SUMMARY (317,842 cells):");
  console.table(assamStats.rows);

  const meghalayaStats = await pool.query(`
    SELECT 
      COUNT(*) AS total_cells,
      ROUND(AVG(elevation_mean)::numeric, 1) AS avg_elevation,
      ROUND(MIN(elevation_min)::numeric, 1) AS min_elevation,
      ROUND(MAX(elevation_max)::numeric, 1) AS max_elevation,
      ROUND(AVG(slope_mean)::numeric, 1) AS avg_slope,
      ROUND(AVG(distance_to_river)::numeric, 1) AS avg_river_dist,
      ROUND(AVG(waterbody_percentage)::numeric, 1) AS avg_water_pct,
      COUNT(*) FILTER (WHERE flood_susceptibility > 0) AS flood_vulnerable_cells,
      COUNT(*) FILTER (WHERE landslide_susceptibility > 0) AS landslide_vulnerable_cells,
      ROUND(AVG(population_density)::numeric, 1) AS avg_pop_density,
      ROUND(AVG(infrastructure_exposure)::numeric, 1) AS avg_infra_exposure,
      COUNT(*) FILTER (WHERE seismic_risk = 100) AS seismic_zone_v_cells
    FROM grid_500m.meghalaya;
  `);

  console.log("\n📍 MEGHALAYA 500m GRID SUMMARY (91,144 cells):");
  console.table(meghalayaStats.rows);

  const sampleRows = await pool.query(`
    SELECT grid_id, state, district, ROUND(elevation_mean::numeric, 0) AS elev, 
           ROUND(slope_mean::numeric, 1) AS slope, flood_susceptibility AS flood, 
           landslide_susceptibility AS landslide, seismic_risk AS seismic,
           ROUND(population_density::numeric, 0) AS pop_den,
           ROUND(infrastructure_exposure::numeric, 0) AS infra
    FROM grid_500m.assam 
    WHERE flood_susceptibility > 0 OR landslide_susceptibility > 50
    LIMIT 5;
  `);

  console.log("\n🔍 SAMPLE MULTI-HAZARD CELLS (Assam):");
  console.table(sampleRows.rows);

  const allDatasets = await getAllDatasets();
  console.log("\n📋 DATASET REGISTRY AUDIT STATUS:");
  console.table(
    allDatasets.map((d) => ({
      factor: d.factor,
      dataset_name: d.dataset_name,
      status: d.processing_status,
      records: d.total_records,
      updated_at: d.updated_at,
    }))
  );

  process.exit(0);
}

run().catch((err) => {
  console.error("❌ Error running static factors pipeline:", err);
  process.exit(1);
});
