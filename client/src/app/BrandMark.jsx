// Vector and Image BrandMark for RESQ disaster intelligence
import React from 'react'

export function BrandMark({ height = 44, className }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        userSelect: 'none',
      }}
      className={className}
      aria-label="resQ Brand"
    >
      <img
        src="/logo.png"
        alt="resQ"
        style={{
          height: `${height}px`,
          width: 'auto',
          objectFit: 'contain',
          display: 'block',
        }}
      />
    </div>
  )
}

export default BrandMark
