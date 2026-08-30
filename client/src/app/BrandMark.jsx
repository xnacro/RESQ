// Vector BrandMark for RESQ disaster intelligence
import { ShieldAlert } from 'lucide-react'

export function BrandMark({ size = 24, className }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size + 10,
        height: size + 10,
        borderRadius: '10px',
        background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
        color: '#ffffff',
        boxShadow: '0 2px 8px rgba(37, 99, 235, 0.35)',
      }}
      className={className}
      aria-hidden="true"
    >
      <ShieldAlert size={size} strokeWidth={2.2} />
    </div>
  )
}
