// Valhalla routing engine health and connectivity service for RESQ backend

const DEFAULT_VALHALLA_URL = "http://127.0.0.1:8002";

// Retrieve the configured Valhalla base URL from environment
export function getValhallaUrl() {
  return process.env.VALHALLA_URL || DEFAULT_VALHALLA_URL;
}

// Check connectivity and operational status of the upstream Valhalla instance
export async function checkValhallaHealth(timeoutMs = 3000) {
  const baseUrl = getValhallaUrl();
  const targetUrl = `${baseUrl.replace(/\/+$/, "")}/status`;
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(targetUrl, {
      method: "GET",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });

    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      return {
        healthy: false,
        statusCode: response.status,
        url: targetUrl,
        latencyMs,
        error: `Valhalla returned HTTP ${response.status}`,
      };
    }

    const data = await response.json();
    return {
      healthy: true,
      statusCode: response.status,
      url: targetUrl,
      latencyMs,
      version: data.version,
      tilesetLastModified: data.tileset_last_modified,
      availableActions: data.available_actions || [],
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    return {
      healthy: false,
      statusCode: null,
      url: targetUrl,
      latencyMs,
      error: error.message,
    };
  }
}
