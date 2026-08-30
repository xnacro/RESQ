// In-Process Disaster Text Classifier Service
// Evaluates exported TF-IDF + Logistic Regression parameters in pure Node.js with sub-millisecond latency
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Internal Model Cache State
let modelState = {
  isReady: false,
  version: "v1",
  classes: [],
  vocabulary: new Map(),
  idf: [],
  coefficients: [],
  intercept: [],
  loadError: null,
};

// Loads model parameters from JSON artifact into memory
export function loadModel(customPath = null) {
  try {
    const artifactPath =
      customPath ||
      path.resolve(__dirname, "../../../ml/models/model_v1.json");

    if (!fs.existsSync(artifactPath)) {
      console.warn(`[ML-CLASSIFIER] Model artifact not found at ${artifactPath}. Fallback enabled.`);
      modelState.isReady = false;
      modelState.loadError = "Model artifact file missing";
      return false;
    }

    const rawData = fs.readFileSync(artifactPath, "utf8");
    const jsonModel = JSON.parse(rawData);

    // Build fast Map lookup for vocabulary
    const vocabMap = new Map();
    if (jsonModel.vocabulary && typeof jsonModel.vocabulary === "object") {
      for (const [term, idx] of Object.entries(jsonModel.vocabulary)) {
        vocabMap.set(term, idx);
      }
    }

    modelState = {
      isReady: true,
      version: jsonModel.model_version || "v1",
      classes: jsonModel.classes || [],
      vocabulary: vocabMap,
      idf: jsonModel.idf || [],
      coefficients: jsonModel.coefficients || [],
      intercept: jsonModel.intercept || [],
      loadError: null,
    };

    console.log(
      `[ML-CLASSIFIER] Loaded model ${modelState.version} (${modelState.classes.length} classes, ${modelState.vocabulary.size} features) successfully.`
    );
    return true;
  } catch (error) {
    console.error("[ML-CLASSIFIER] Failed to load model artifact:", error.message);
    modelState.isReady = false;
    modelState.loadError = error.message;
    return false;
  }
}

// Tokenizes text into unigrams and bigrams matching scikit-learn standard token pattern r'(?u)\b\w+\b'
function extractNgrams(text) {
  if (!text || typeof text !== "string") return [];
  const clean = text.toLowerCase();
  const tokens = clean.match(/\b\w+\b/g) || [];

  const ngrams = [];
  // Unigrams
  for (let i = 0; i < tokens.length; i++) {
    ngrams.push(tokens[i]);
  }
  // Bigrams
  for (let i = 0; i < tokens.length - 1; i++) {
    ngrams.push(`${tokens[i]} ${tokens[i + 1]}`);
  }

  return ngrams;
}

// Classifies an input text headline/lead paragraph
export function classifyDisasterText(text) {
  // Graceful fail-safe if model is not ready
  if (!modelState.isReady) {
    return {
      isReady: false,
      label: "UNKNOWN",
      confidence: 0.0,
      probabilities: {},
      modelVersion: modelState.version,
      isDisaster: false,
      fallback: true,
    };
  }

  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return {
      isReady: true,
      label: "IRRELEVANT",
      confidence: 1.0,
      probabilities: { IRRELEVANT: 1.0 },
      modelVersion: modelState.version,
      isDisaster: false,
      fallback: false,
    };
  }

  const ngrams = extractNgrams(text);
  const termCounts = new Map();

  for (const token of ngrams) {
    termCounts.set(token, (termCounts.get(token) || 0) + 1);
  }

  // 1. Build TF-IDF feature map (feature_index -> weighted_value)
  const featureWeights = new Map();
  let sumSquared = 0.0;

  for (const [token, count] of termCounts.entries()) {
    const featIdx = modelState.vocabulary.get(token);
    if (featIdx !== undefined && featIdx < modelState.idf.length) {
      // Sublinear TF formula: 1 + ln(count)
      const sublinearTf = 1.0 + Math.log(count);
      const tfidf = sublinearTf * modelState.idf[featIdx];
      featureWeights.set(featIdx, tfidf);
      sumSquared += tfidf * tfidf;
    }
  }

  // L2 Normalization
  const norm = Math.sqrt(sumSquared);
  if (norm > 0) {
    for (const [featIdx, val] of featureWeights.entries()) {
      featureWeights.set(featIdx, val / norm);
    }
  }

  // 2. Compute Logistic Regression Linear Scores: z_k = b_k + sum(W_k,j * x_j)
  const numClasses = modelState.classes.length;
  const rawScores = new Array(numClasses).fill(0);

  for (let k = 0; k < numClasses; k++) {
    let score = modelState.intercept[k] || 0.0;
    const coefRow = modelState.coefficients[k];
    if (coefRow) {
      for (const [featIdx, xVal] of featureWeights.entries()) {
        score += (coefRow[featIdx] || 0.0) * xVal;
      }
    }
    rawScores[k] = score;
  }

  // 3. Compute Softmax Probabilities with numerical max subtraction
  let maxScore = -Infinity;
  for (let k = 0; k < numClasses; k++) {
    if (rawScores[k] > maxScore) maxScore = rawScores[k];
  }

  const expScores = new Array(numClasses);
  let expSum = 0.0;
  for (let k = 0; k < numClasses; k++) {
    const expVal = Math.exp(rawScores[k] - maxScore);
    expScores[k] = expVal;
    expSum += expVal;
  }

  const probabilities = {};
  let bestClassIdx = 0;
  let bestProb = -1.0;

  for (let k = 0; k < numClasses; k++) {
    const prob = expSum > 0 ? expScores[k] / expSum : 1.0 / numClasses;
    const className = modelState.classes[k];
    probabilities[className] = Number(prob.toFixed(4));

    if (prob > bestProb) {
      bestProb = prob;
      bestClassIdx = k;
    }
  }

  const predictedLabel = modelState.classes[bestClassIdx] || "IRRELEVANT";
  const confidence = Number(bestProb.toFixed(4));

  return {
    isReady: true,
    label: predictedLabel,
    confidence,
    probabilities,
    modelVersion: modelState.version,
    isDisaster: predictedLabel === "ACTIVE_DISASTER",
    fallback: false,
  };
}

// Check service status
export function getClassifierStatus() {
  return {
    isReady: modelState.isReady,
    version: modelState.version,
    classes: modelState.classes,
    featureCount: modelState.vocabulary.size,
    loadError: modelState.loadError,
  };
}

// Initial model load on startup
loadModel();

export default {
  loadModel,
  classifyDisasterText,
  getClassifierStatus,
};
