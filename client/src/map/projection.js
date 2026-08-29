// Display-only Web Mercator adapter so overlays can be positioned on screen.
// This is presentation math, not spatial analysis. The real map service
// replaces it by supplying its own project and unproject pair.

const TILE_SIZE = 256
const MAX_LAT = 85.05112878

function clampLat(lat) {
  return Math.min(MAX_LAT, Math.max(-MAX_LAT, lat))
}

export function lonToWorldX(lon) {
  return (lon + 180) / 360
}

export function latToWorldY(lat) {
  const sin = Math.sin((clampLat(lat) * Math.PI) / 180)
  return 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)
}

export function worldXToLon(x) {
  return x * 360 - 180
}

export function worldYToLat(y) {
  const n = Math.PI * (1 - 2 * y)
  return (180 / Math.PI) * Math.atan(Math.sinh(n))
}

export function worldSizeAt(zoom) {
  return TILE_SIZE * Math.pow(2, zoom)
}

// Builds the screen transform for a given camera and container size
export function createProjection({ center, zoom, width, height }) {
  const worldSize = worldSizeAt(zoom)
  const originX = lonToWorldX(center[0]) * worldSize - width / 2
  const originY = latToWorldY(center[1]) * worldSize - height / 2

  function project(lon, lat) {
    return [lonToWorldX(lon) * worldSize - originX, latToWorldY(lat) * worldSize - originY]
  }

  function unproject(x, y) {
    return [worldXToLon((x + originX) / worldSize), worldYToLat((y + originY) / worldSize)]
  }

  return { project, unproject, worldSize, width, height, zoom, center }
}

// Ground resolution in metres per pixel, used by the scale bar
export function metersPerPixel(lat, zoom) {
  return (156543.03392 * Math.cos((clampLat(lat) * Math.PI) / 180)) / Math.pow(2, zoom)
}
