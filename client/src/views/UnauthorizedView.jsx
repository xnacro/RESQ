// 403 Forbidden State View for RESQ
import { Link } from 'react-router-dom'
import { ShieldAlert, ArrowLeft } from 'lucide-react'
import { useAuth } from '../app/authContext.jsx'

export default function UnauthorizedView() {
  const { user, openAuthModal } = useAuth()

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 'calc(100vh - 56px)',
        padding: '40px 20px',
        backgroundColor: '#f8fafc',
        fontFamily: "'Inter Variable', sans-serif",
        textAlign: 'center',
      }}
    >
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          padding: '40px 48px',
          maxWidth: '480px',
          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: '#fee2e2',
            color: '#dc2626',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px auto',
          }}
        >
          <ShieldAlert size={32} />
        </div>

        <h1
          style={{
            fontSize: '22px',
            fontWeight: 700,
            color: '#0f172a',
            margin: '0 0 10px 0',
          }}
        >
          403 — Restricted Command Level
        </h1>

        <p
          style={{
            fontSize: '14px',
            color: '#64748b',
            lineHeight: 1.6,
            margin: '0 0 24px 0',
          }}
        >
          Your current personnel role (<strong>{user?.role || 'UNAUTHENTICATED / VIEWER'}</strong>) does not have
          sufficient clearance to access this operational module. Please sign in with an Administrator account or contact the State Disaster
          Command Administrator.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
          {!user && (
            <button
              type="button"
              onClick={() => openAuthModal('login')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <span>Sign In as Admin</span>
            </button>
          )}

          <Link
            to="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: user ? '#2563eb' : '#f1f5f9',
              color: user ? '#ffffff' : '#334155',
              padding: '10px 20px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            <ArrowLeft size={16} />
            <span>Return to Dashboard</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
