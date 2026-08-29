// Risk band vocabulary and score thresholds shared by every risk surface

export const RISK_BANDS = ['LOW', 'MODERATE', 'HIGH', 'CRITICAL']

export const BAND_THRESHOLDS = [
  { band: 'LOW', min: 0, max: 29 },
  { band: 'MODERATE', min: 30, max: 54 },
  { band: 'HIGH', min: 55, max: 79 },
  { band: 'CRITICAL', min: 80, max: 100 },
]

export const BAND_META = {
  LOW: { label: 'Low', token: 'var(--risk-low)', short: 'L' },
  MODERATE: { label: 'Moderate', token: 'var(--risk-moderate)', short: 'M' },
  HIGH: { label: 'High', token: 'var(--risk-high)', short: 'H' },
  CRITICAL: { label: 'Critical', token: 'var(--risk-critical)', short: 'C' },
  UNKNOWN: { label: 'Unknown', token: 'var(--text-faint)', short: '?' },
}

// Maps a 0 to 100 score onto a band, returns UNKNOWN for missing data
export function scoreToBand(score) {
  if (typeof score !== 'number' || Number.isNaN(score)) return 'UNKNOWN'
  const clamped = Math.min(100, Math.max(0, score))
  const match = BAND_THRESHOLDS.find((t) => clamped >= t.min && clamped <= t.max)
  return match ? match.band : 'UNKNOWN'
}

export function bandRank(band) {
  const index = RISK_BANDS.indexOf(band)
  return index === -1 ? -1 : index
}

export function isBand(value) {
  return RISK_BANDS.includes(value)
}
