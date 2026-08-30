// Dataset Registry Seed Script
// Registers official data provenance metadata for all 9 static factors into PostgreSQL datasets.registry
import { initRegistrySchema, upsertDatasetMetadata } from "../services/datasets/datasetRegistryService.js";
import pool from "../config/db.js";

const STATIC_FACTOR_REGISTRY = [
  {
    dataset_name: "Copernicus_GLO30_Elevation",
    factor: "elevation_mean",
    source_name: "Copernicus GLO-30 Digital Elevation Model (DEM)",
    provider: "European Space Agency (ESA) / Copernicus Open Access",
    official_url: "https://spacedata.copernicus.eu/collections/copernicus-digital-elevation-model",
    implementation_url: "https://copernicus-dem-30m.s3.amazonaws.com/",
    source_type: "RASTER_GEOTIFF",
    format: "Cloud Optimized GeoTIFF (COG)",
    resolution: "30m (1 arc-second)",
    temporal_coverage: "2011-2015 baseline (WorldDEM TanDEM-X)",
    geographic_coverage: "100% of Assam (Brahmaputra/Barak Valleys) and Meghalaya (Shillong Plateau)",
    version: "GLO-30 2022_1",
    processing_status: "REGISTERED",
    notes: "Authoritative 30m terrain elevation for slope calculation, flood basin depression mapping, and route grade assessment.",
  },
  {
    dataset_name: "Copernicus_GLO30_Slope",
    factor: "slope_mean",
    source_name: "Derived from Copernicus GLO-30 DEM (Horn 1981 Algorithm)",
    provider: "European Space Agency (ESA) / RESQ Pipeline",
    official_url: "https://spacedata.copernicus.eu/collections/copernicus-digital-elevation-model",
    implementation_url: "https://copernicus-dem-30m.s3.amazonaws.com/",
    source_type: "DERIVED_RASTER",
    format: "Raster Float32 (Slope in degrees, 0° to 90°)",
    resolution: "30m (1 arc-second)",
    temporal_coverage: "Static baseline derived from DEM",
    geographic_coverage: "100% of Assam and Meghalaya grids",
    version: "2026.1",
    processing_status: "REGISTERED",
    notes: "Directly drives landslide susceptibility and mountain road impassability thresholds.",
  },
  {
    dataset_name: "ISRO_NDEM_NRSC_Flood_Inundation_History",
    factor: "flood_susceptibility",
    source_name: "National Database for Emergency Management (NDEM) / NRSC ISRO",
    provider: "National Remote Sensing Centre (NRSC) / ISRO",
    official_url: "https://bhuvan-app1.nrsc.gov.in/disaster/disaster.php?id=flood",
    implementation_url: "https://ndem.nrsc.gov.in/arcgis/rest/services/NDEM",
    source_type: "VECTOR_POLYGONS",
    format: "Multi-temporal Satellite Microwave / Optical Inundation Polygons (1998-2022)",
    resolution: "30m - 50m spatial resolution across 24 flood seasons",
    temporal_coverage: "1998 to 2022 (Annual monsoon flood layers)",
    geographic_coverage: "All 35 Assam districts & Meghalaya border floodplains (20,645 historical inundation polygons)",
    version: "2022.1",
    processing_status: "PROCESSED",
    notes: "Multi-year historical flood inundation recurrence mapped to normalized 0-100 susceptibility score.",
  },
  {
    dataset_name: "GSI_National_Landslide_Susceptibility_Mapping",
    factor: "landslide_susceptibility",
    source_name: "Geological Survey of India (GSI) / Bhusanket & Bhukosh",
    provider: "GSI Bhusanket Geoportal / Bhukosh Data Repository",
    official_url: "https://bhukosh.gsi.gov.in/",
    implementation_url: "https://bhusanket.gsi.gov.in/geoserver/wfs",
    source_type: "VECTOR_OGC_WFS_BHUKOSH",
    format: "OGC WFS Vector / Bhukosh Job Queue Shapefile (5-tier zonation: Very High, High, Moderate, Low, Nil)",
    resolution: "1:50,000 scale Macro-zonation",
    temporal_coverage: "National Landslide Susceptibility Mapping (NLSM) 2014-2022",
    geographic_coverage: "100% of Meghalaya plateau & Assam hilly districts (Dima Hasao, Karbi Anglong)",
    version: "NLSM 2.0",
    processing_status: "REGISTERED",
    notes: "Official landslide susceptibility zonation for hilly terrain in NE India. Ingested via OGC WFS geometry stream or Bhukosh vector batch queue (replaces image-only WMS).",
  },
  {
    dataset_name: "BIS_IS1893_NDMA_Seismic_Zoning",
    factor: "seismic_risk",
    source_name: "Bureau of Indian Standards (BIS) IS 1893:2016 / NDMA",
    provider: "NDMA / BIS",
    official_url: "https://ndma.gov.in/Natural-Hazards/Earthquakes",
    implementation_url: "https://bhuvan-app1.nrsc.gov.in/disaster/disaster.php?id=earthquake",
    source_type: "STANDARDS_VECTOR",
    format: "Vector Polygons (Seismic Zones II to V)",
    resolution: "National / State scale (Macro-seismic zonation)",
    temporal_coverage: "IS 1893 (Part 1): 2016 revision",
    geographic_coverage: "100% of Assam and Meghalaya (All Zone V)",
    version: "IS 1893:2016",
    processing_status: "REGISTERED",
    notes: "Both Assam and Meghalaya lie 100% within Seismic Zone V (Zone factor Z=0.36, severe earthquake hazard).",
  },
  {
    dataset_name: "IndiaWRIS_HydroRIVERS_Drainage_Network",
    factor: "distance_to_river",
    source_name: "Central Water Commission (CWC) India-WRIS / HydroRIVERS v1.0",
    provider: "Ministry of Jal Shakti / WWF HydroSHEDS",
    official_url: "https://indiawris.gov.in/",
    implementation_url: "https://www.hydrosheds.org/products/hydrorivers",
    source_type: "VECTOR_LINESTRING",
    format: "GeoPackage / Shapefile (River centerlines with discharge and stream order)",
    resolution: "15 arc-seconds (~500m detail) & 1:50,000 major rivers",
    temporal_coverage: "Static baseline drainage network",
    geographic_coverage: "Brahmaputra, Barak, Meghna river basins (Assam & Meghalaya)",
    version: "HydroRIVERS v1.0",
    processing_status: "REGISTERED",
    notes: "Used to compute Euclidean / geodesic distance_to_river for all 500m grid cells.",
  },
  {
    dataset_name: "ISRO_SAC_National_Wetlands_Bhuvan_LULC",
    factor: "waterbody_percentage",
    source_name: "Space Applications Centre (SAC/ISRO) & NRSC Bhuvan",
    provider: "NRSC Bhuvan / SAC",
    official_url: "https://vedas.sac.gov.in/en/wetlands.html",
    implementation_url: "https://bhuvan-app1.nrsc.gov.in/2dresources/bhuvanstore.php",
    source_type: "VECTOR_POLYGON",
    format: "Vector Shapefile / GeoJSON (Lakes, Beels, Reservoirs, Rivers, Ponds)",
    resolution: "1:50,000 scale (Wetlands > 2.25 ha)",
    temporal_coverage: "National Wetland Atlas (2020-2022 update)",
    geographic_coverage: "Assam & Meghalaya wetlands and waterbodies",
    version: "2022",
    processing_status: "REGISTERED",
    notes: "Used to calculate waterbody_percentage coverage inside each 500m grid cell.",
  },
  {
    dataset_name: "Census_India_GHSL_Population_Grid",
    factor: "population_density",
    source_name: "Census of India 2011 / Global Human Settlement Layer (GHSL-POP)",
    provider: "Office of the Registrar General of India / European Commission JRC",
    official_url: "https://censusindia.gov.in/",
    implementation_url: "https://human-settlement.emergency.copernicus.eu/ghs_pop2023.php",
    source_type: "RASTER_GEOTIFF",
    format: "GeoTIFF (Persons per grid cell, constrained by Census totals)",
    resolution: "100m - 500m gridded population",
    temporal_coverage: "Census 2011 + 2020/2025 demographic projections",
    geographic_coverage: "100% of Assam and Meghalaya (rural + urban)",
    version: "GHS-POP R2023A",
    processing_status: "REGISTERED",
    notes: "Determines population_density and human exposure for relief priority scoring.",
  },
  {
    dataset_name: "OSM_PMGSY_Transport_Infrastructure",
    factor: "infrastructure_exposure",
    source_name: "OpenStreetMap (Geofabrik North-East) / MoRTH & PMGSY",
    provider: "OpenStreetMap Community / Geofabrik",
    official_url: "https://www.openstreetmap.org/",
    implementation_url: "https://download.geofabrik.de/asia/india/north-eastern-zone.html",
    source_type: "VECTOR_LINESTRING",
    format: "OSM PBF / GeoJSON (Highways, bridges, primary/secondary/rural roads)",
    resolution: "High-precision vector topology (<5m accuracy)",
    temporal_coverage: "2024-2026 active infrastructure network",
    geographic_coverage: "100% road and bridge network across Assam and Meghalaya",
    version: "2026.08",
    processing_status: "REGISTERED",
    notes: "Provides road density, bridge presence, and critical access corridors for infrastructure_exposure.",
  },
];

async function registerAll() {
  await initRegistrySchema();
  console.log("Registering all 9 static factors into datasets.registry...");

  for (const ds of STATIC_FACTOR_REGISTRY) {
    const res = await upsertDatasetMetadata(ds);
    console.log(`  - [${res.factor.padEnd(25)}] ${res.dataset_name} (${res.processing_status})`);
  }

  console.log("All 9 static factor datasets registered successfully.");
  await pool.end();
}

if (process.argv[1]?.endsWith("registerAllStaticDatasets.js")) {
  registerAll().catch((err) => {
    console.error("Failed to register datasets:", err);
    process.exit(1);
  });
}

export default {
  STATIC_FACTOR_REGISTRY,
  registerAll,
};
