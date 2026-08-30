// Automated News Ingestion & NLP Disaster Processing Scheduler (Cron)
// Runs periodic polling of RSS feeds followed by NLP event extraction and 500m grid linking
import { pollAllRssSources } from "./rssService.js";
import { processPendingNewsItems } from "./newsEventService.js";
import { expireStaleEvents } from "../risk/dynamicRiskService.js";

let schedulerTimer = null;
let isJobRunning = false;

const schedulerState = {
  isRunning: false,
  intervalMinutes: 15,
  totalRuns: 0,
  lastRunAt: null,
  nextRunAt: null,
  lastStatus: "IDLE",
  lastError: null,
  metrics: {
    totalItemsIngested: 0,
    totalEventsCreated: 0,
    totalGridsLinked: 0,
  },
};

// Executes a single end-to-end ingestion and NLP extraction cycle
export const runPipelineCycle = async () => {
  if (isJobRunning) {
    console.log("⏳ News pipeline cycle is already in progress, skipping overlapping run...");
    return { status: "SKIPPED", reason: "Already running" };
  }

  isJobRunning = true;
  schedulerState.lastRunAt = new Date().toISOString();
  schedulerState.lastStatus = "RUNNING";
  schedulerState.totalRuns++;

  const cycleStart = Date.now();
  console.log(`\n===============================================================`);
  console.log(`⏰ [CRON] Starting News Pipeline Cycle #${schedulerState.totalRuns} at ${schedulerState.lastRunAt}...`);
  console.log(`===============================================================`);

  try {
    // 1. Poll all configured active RSS feeds
    console.log("📡 [CRON] Step 1/2: Polling RSS sources...");
    const pollResults = await pollAllRssSources();
    const newItemsCount = pollResults.reduce((acc, r) => acc + (r.newItems || 0), 0);
    schedulerState.metrics.totalItemsIngested += newItemsCount;

    // 2. Process all pending items through NLP extraction and 500m grid linking
    console.log("🧠 [CRON] Step 2/3: Processing pending items via NLP...");
    const nlpSummary = await processPendingNewsItems(50);
    schedulerState.metrics.totalEventsCreated += nlpSummary.eventsCreated || 0;
    schedulerState.metrics.totalGridsLinked += nlpSummary.gridsLinked || 0;

    // 3. Expire stale events and recalibrate affected grid cells
    console.log("🧹 [CRON] Step 3/3: Running event expiration & dynamic risk decay...");
    const expireSummary = await expireStaleEvents();

    const durationSec = ((Date.now() - cycleStart) / 1000).toFixed(2);
    schedulerState.lastStatus = "SUCCESS";
    schedulerState.lastError = null;

    console.log(`🎉 [CRON] Cycle #${schedulerState.totalRuns} completed in ${durationSec}s:`);
    console.log(`   ↳ New Items Stored: ${newItemsCount}`);
    console.log(`   ↳ Events Created: ${nlpSummary.eventsCreated}`);
    console.log(`   ↳ 500m Grids Linked: ${nlpSummary.gridsLinked}`);
    console.log(`   ↳ Stale Events Expired: ${expireSummary.expiredEventsCount}\n`);

    return {
      status: "SUCCESS",
      durationSec,
      newItemsCount,
      nlpSummary,
      expireSummary,
    };
  } catch (err) {
    console.error(`❌ [CRON] Cycle #${schedulerState.totalRuns} failed:`, err.message);
    schedulerState.lastStatus = "FAILED";
    schedulerState.lastError = err.message;
    return { status: "FAILED", error: err.message };
  } finally {
    isJobRunning = false;
    if (schedulerState.isRunning) {
      schedulerState.nextRunAt = new Date(Date.now() + schedulerState.intervalMinutes * 60 * 1000).toISOString();
    }
  }
};

// Starts the automated background cron scheduler
export const startNewsScheduler = (intervalMinutes = 15, runImmediately = true) => {
  if (schedulerState.isRunning) {
    console.log(`⚠️ News scheduler is already running (interval: ${schedulerState.intervalMinutes}m).`);
    return schedulerState;
  }

  schedulerState.isRunning = true;
  schedulerState.intervalMinutes = intervalMinutes;
  schedulerState.nextRunAt = new Date(Date.now() + intervalMinutes * 60 * 1000).toISOString();

  console.log(`🚀 News & NLP background scheduler started! Polling every ${intervalMinutes} minutes.`);

  if (runImmediately) {
    runPipelineCycle().catch((err) => console.error("Initial cycle error:", err));
  }

  schedulerTimer = setInterval(() => {
    runPipelineCycle().catch((err) => console.error("Interval cycle error:", err));
  }, intervalMinutes * 60 * 1000);

  return schedulerState;
};

// Stops the automated background cron scheduler
export const stopNewsScheduler = () => {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
  schedulerState.isRunning = false;
  schedulerState.nextRunAt = null;
  schedulerState.lastStatus = "STOPPED";
  console.log("🛑 News & NLP background scheduler stopped.");
  return schedulerState;
};

// Returns current scheduler status and historical metrics
export const getSchedulerStatus = () => {
  return {
    ...schedulerState,
    isCurrentlyProcessing: isJobRunning,
  };
};

export default {
  startNewsScheduler,
  stopNewsScheduler,
  runPipelineCycle,
  getSchedulerStatus,
};
