// Pipeline script to register datasets, ingest flood polygons, and compute 500m grid flood susceptibility
import fs from "fs";
import path from "path";
import pool from "../config/db.js";
import { initRegistrySchema, upsertDatasetMetadata, updateProcessingStatus } from "../services/datasets/datasetRegistryService.js";
import { FLOOD_DATASETS, ingestGeoJsonLToDb, calculateStateFloodSusceptibility } from "../services/datasets/floodDatasetService.js";

const EXTRACTED_DIR = "f:/RESQ/data/flood/extracted";

async function runPipeline() {
  console.log("==========================================");
  console.log("🌊 STARTING RESQ FLOOD INGESTION PIPELINE");
  console.log("==========================================\n");

  // 1. Initialize schema
  await initRegistrySchema();

  // 2. Register metadata in datasets.registry
  console.log("\n1. Registering dataset metadata in datasets.registry...");
  for (const key of Object.keys(FLOOD_DATASETS)) {
    const meta = FLOOD_DATASETS[key];
    await upsertDatasetMetadata({
      dataset_name: meta.dataset_name,
      factor: meta.factor,
      source_name: meta.source_name,
      provider: meta.provider,
      official_url: meta.official_url,
      implementation_url: meta.implementation_url,
      source_type: meta.source_type,
      format: meta.format,
      resolution: meta.resolution,
      temporal_coverage: meta.temporal_coverage,
      geographic_coverage: meta.geographic_coverage,
      download_path: path.join(EXTRACTED_DIR, meta.extracted_name),
      processing_status: "EXTRACTED",
      notes: "Authoritative NDEM/NRSC satellite microwave flood inundation mapping.",
    });
  }
  console.log("✅ Metadata registered successfully.");

  // 3. Ingest Meghalaya flood inundation features
  const mlPath = path.join(EXTRACTED_DIR, FLOOD_DATASETS.MeghalayaInundation.extracted_name);
  if (fs.existsSync(mlPath)) {
    console.log("\n2. Ingesting Meghalaya flood features into PostGIS...");
    const mlCount = await ingestGeoJsonLToDb(mlPath, "Meghalaya", 150);
    await updateProcessingStatus(FLOOD_DATASETS.MeghalayaInundation.dataset_name, "PROCESSED", mlCount);

    // Calculate Meghalaya grid flood susceptibility
    console.log("\n3. Calculating static flood susceptibility for grid_500m.meghalaya...");
    const mlStats = await calculateStateFloodSusceptibility("Meghalaya");
    console.log("Meghalaya Grid Stats:", mlStats);
  }

  // 4. Ingest Assam multi-year flood features
  const asPath = path.join(EXTRACTED_DIR, FLOOD_DATASETS.AssamYearlyAggregate.extracted_name);
  if (fs.existsSync(asPath)) {
    console.log("\n4. Ingesting Assam flood features into PostGIS...");
    const asCount = await ingestGeoJsonLToDb(asPath, "Assam", 150, 30000);
    await updateProcessingStatus(FLOOD_DATASETS.AssamYearlyAggregate.dataset_name, "PROCESSED", asCount);

    // Calculate Assam grid flood susceptibility
    console.log("\n5. Calculating static flood susceptibility for grid_500m.assam...");
    const asStats = await calculateStateFloodSusceptibility("Assam");
    console.log("Assam Grid Stats:", asStats);
  }

  console.log("\n==========================================");
  console.log("🎉 FLOOD PIPELINE COMPLETED SUCCESSFULLY!");
  console.log("==========================================\n");

  process.exit(0);
}

runPipeline().catch((err) => {
  console.error("❌ Pipeline error:", err);
  process.exit(1);
});
