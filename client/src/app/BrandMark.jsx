// resQ grid mark, a selected cell inside a spatial grid. Inherits currentColor
// so it reads correctly on the page frame and on a tile alike.
export function BrandMark({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label="resQ">
      <g stroke="currentColor" strokeWidth="1.25" opacity="0.4">
        <path d="M4 12h24M4 20h24M12 4v24M20 4v24" />
      </g>
      <rect x="12" y="12" width="8" height="8" fill="currentColor" opacity="0.16" />
      <rect x="12.6" y="12.6" width="6.8" height="6.8" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="16" cy="16" r="1.9" fill="currentColor" />
    </svg>
  )
}
