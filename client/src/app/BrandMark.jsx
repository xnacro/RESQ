// Vector and Image BrandMark for RESQ disaster intelligence
import React from 'react'

export function BrandMark({ height = 28, className, showText = false }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        userSelect: 'none',
      }}
      className={className}
      aria-label="resQ Brand"
    >
      <img
        src="/resq-logo.png"
        alt="resQ"
        style={{
          height: `${height}px`,
          width: 'auto',
          objectFit: 'contain',
          display: 'block',
          mixBlendMode: 'multiply',
        }}
      />
      {showText && (
        <span
          style={{
            fontSize: `${Math.round(height * 0.55)}px`,
            fontWeight: 800,
            letterSpacing: '-0.02em',
            color: '#0f172a',
          }}
        >
          resQ
        </span>
      )}
    </div>
  )
}

export default BrandMark
