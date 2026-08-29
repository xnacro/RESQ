// Display formatters, kept out of components so units stay consistent

export function formatScore(score) {
  if (typeof score !== 'number' || Number.isNaN(score)) return '--'
  return String(Math.round(score))
}

export function formatDistance(km) {
  if (typeof km !== 'number' || Number.isNaN(km)) return '--'
  if (km < 1) return `${Math.round(km * 1000)} m`
  return `${km >= 100 ? Math.round(km) : km.toFixed(1)} km`
}

export function formatDuration(minutes) {
  if (typeof minutes !== 'number' || Number.isNaN(minutes)) return '--'
  const total = Math.round(minutes)
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h === 0) return `${m} min`
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`
}

export function formatCoord(lon, lat, precision = 4) {
  if (typeof lon !== 'number' || typeof lat !== 'number') return '--'
  const ns = lat >= 0 ? 'N' : 'S'
  const ew = lon >= 0 ? 'E' : 'W'
  return `${Math.abs(lat).toFixed(precision)}${ns} ${Math.abs(lon).toFixed(precision)}${ew}`
}

export function formatRelativeTime(iso, now = Date.now()) {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return '--'
  const diffMin = Math.round((now - then) / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin} min ago`
  const diffHr = Math.round(diffMin / 60)
  if (diffHr < 24) return `${diffHr} hr ago`
  return `${Math.round(diffHr / 24)} d ago`
}

export function formatCount(value, singular, plural) {
  const word = value === 1 ? singular : plural || `${singular}s`
  return `${value} ${word}`
}
