// RESQ Authentication System - Exact Design Reference Modal Overlay on Live Map Dashboard

import { useState, useRef } from 'react'
import {
  Shield,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  Camera,
  CheckCircle2,
  AlertCircle,
  Phone,
  User,
  Radio,
  Check,
} from 'lucide-react'
import { useAuth } from '../app/authContext.jsx'
import styles from './LoginView.module.css'

export function LoginView({ initialMode = 'login' }) {
  const { login, register } = useAuth()

  // Mode: 'login' | 'register' | 'forgot' | 'reset'
  const [mode, setMode] = useState(initialMode)

  // Register Step: 1 | 2
  const [step, setStep] = useState(1)

  // Login form state
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)

  // Register form state (Step 1)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [mobile, setMobile] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showRegPassword, setShowRegPassword] = useState(false)
  const [profilePhoto, setProfilePhoto] = useState(null)
  const fileInputRef = useRef(null)

  // Register form state (Step 2)
  const [username, setUsername] = useState('')
  const [usernameStatus, setUsernameStatus] = useState({ checking: false, available: null, message: '' })
  const [selectedRole, setSelectedRole] = useState('Relief Operator') // 'Relief Operator' | 'Monitoring / Viewer'
  const usernameCheckTimerRef = useRef(null)

  // Forgot / Reset password state
  const [forgotIdentifier, setForgotIdentifier] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [devResetLink, setDevResetLink] = useState('')

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [generalError, setGeneralError] = useState('')
  const [generalSuccess, setGeneralSuccess] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})

  // Profile photo upload handler
  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
    if (!validTypes.includes(file.type)) {
      setGeneralError('Please upload a valid image file (JPG, PNG, or WEBP).')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setGeneralError('Profile image size must be under 5MB.')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setProfilePhoto(reader.result)
      setGeneralError('')
    }
    reader.readAsDataURL(file)
  }

  // Real-time debounced username availability check
  const handleUsernameChange = (val) => {
    const clean = val.replace(/^@/, '').toLowerCase().trim()
    setUsername(clean)

    if (usernameCheckTimerRef.current) {
      clearTimeout(usernameCheckTimerRef.current)
    }

    if (!clean) {
      setUsernameStatus({ checking: false, available: null, message: '' })
      return
    }

    if (clean.length < 3) {
      setUsernameStatus({ checking: false, available: false, message: 'Minimum 3 characters' })
      return
    }

    setUsernameStatus({ checking: true, available: null, message: 'Checking availability...' })

    usernameCheckTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/auth/check-username?username=${encodeURIComponent(clean)}`)
        const data = await res.json()
        setUsernameStatus({
          checking: false,
          available: data.available,
          message: data.message || (data.available ? 'Username available' : 'Username taken'),
        })
      } catch {
        setUsernameStatus({ checking: false, available: null, message: '' })
      }
    }, 300)
  }

  // 1. Submit Login
  const handleLoginSubmit = async (e) => {
    e.preventDefault()
    setGeneralError('')
    setGeneralSuccess('')
    setFieldErrors({})

    const errors = {}
    if (!identifier.trim()) errors.identifier = 'Email or mobile number is required.'
    if (!password) errors.password = 'Password is required.'

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setIsSubmitting(true)
    const result = await login(identifier, password, rememberMe)
    setIsSubmitting(false)

    if (!result.success) {
      setGeneralError(result.error || 'Authentication failed. Please verify credentials.')
    }
  }

  // 2. Validate and proceed from Step 1 to Step 2
  const handleProceedToStep2 = (e) => {
    e.preventDefault()
    setGeneralError('')
    const errors = {}

    if (!fullName.trim()) errors.fullName = 'Full name is required.'
    if (!email.trim()) {
      errors.email = 'Email address is required.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Please enter a valid email address.'
    }

    if (mobile.trim() && !/^\+?[0-9\s-]{10,15}$/.test(mobile.trim())) {
      errors.mobile = 'Please enter a valid 10-digit mobile number.'
    }

    if (!regPassword) {
      errors.regPassword = 'Password is required.'
    } else if (regPassword.length < 8) {
      errors.regPassword = 'Password must be at least 8 characters long.'
    }

    if (regPassword !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.'
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setFieldErrors({})
    if (!username) {
      const generated = email.split('@')[0].replace(/[^a-z0-9_]/g, '_').toLowerCase()
      setUsername(generated)
      handleUsernameChange(generated)
    }
    setStep(2)
  }

  // 3. Final Step 2 Registration Submission
  const handleRegisterSubmit = async (e) => {
    e.preventDefault()
    setGeneralError('')
    setGeneralSuccess('')
    setFieldErrors({})

    if (!username || username.length < 3) {
      setGeneralError('Please enter a valid username (at least 3 characters).')
      return
    }

    if (usernameStatus.available === false) {
      setGeneralError('This username is already taken. Please pick another.')
      return
    }

    setIsSubmitting(true)
    const res = await register({
      fullName: fullName.trim(),
      name: fullName.trim(),
      email: email.trim(),
      mobile: mobile.trim() || null,
      username: username.trim() || null,
      profilePhoto,
      password: regPassword,
      role: selectedRole,
      department:
        selectedRole === 'Relief Operator'
          ? 'Field Logistics & Convoy Operations'
          : 'Regional Disaster Research & Analytics',
    })
    setIsSubmitting(false)

    if (!res.success) {
      setGeneralError(res.error || 'Registration failed. Please try again.')
    }
  }

  // 4. Submit Forgot Password Request
  const handleForgotSubmit = async (e) => {
    e.preventDefault()
    setGeneralError('')
    setGeneralSuccess('')
    setDevResetLink('')

    if (!forgotIdentifier.trim()) {
      setGeneralError('Please enter your email or mobile number.')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: forgotIdentifier.trim() }),
      })
      const data = await res.json()
      setIsSubmitting(false)

      if (res.ok) {
        setGeneralSuccess(data.message)
        if (data.devResetToken) {
          setResetToken(data.devResetToken)
          setDevResetLink(data.devResetLink)
        }
      } else {
        setGeneralError(data.error || 'Failed to send recovery instructions.')
      }
    } catch {
      setIsSubmitting(false)
      setGeneralError('Network error. Unable to reach recovery service.')
    }
  }

  // 5. Submit Password Reset
  const handleResetSubmit = async (e) => {
    e.preventDefault()
    setGeneralError('')
    setGeneralSuccess('')

    if (!newPassword || newPassword.length < 8) {
      setGeneralError('Password must be at least 8 characters long.')
      return
    }

    if (newPassword !== confirmNewPassword) {
      setGeneralError('Passwords do not match.')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: resetToken,
          newPassword,
          confirmPassword: confirmNewPassword,
        }),
      })
      const data = await res.json()
      setIsSubmitting(false)

      if (res.ok) {
        setGeneralSuccess('Password updated successfully. You may now sign in.')
        setTimeout(() => {
          setMode('login')
          setGeneralSuccess('')
        }, 1500)
      } else {
        setGeneralError(data.error || 'Failed to reset password.')
      }
    } catch {
      setIsSubmitting(false)
      setGeneralError('Network error. Unable to reset password.')
    }
  }

  // Social Login handler
  const handleSocialLogin = async (provider) => {
    setGeneralError('')
    try {
      const res = await fetch(`/api/auth/oauth/${provider}`, { method: 'POST' })
      const data = await res.json()
      if (!data.configured) {
        setGeneralError(`${provider === 'google' ? 'Google' : 'Apple'} sign-in is not configured for this environment.`)
      }
    } catch {
      setGeneralError(`${provider === 'google' ? 'Google' : 'Apple'} sign-in is not configured for this environment.`)
    }
  }

  // Demo auto-fill helper for hackathon evaluators with instant 1-click login
  const handleDemoFill = async (roleType) => {
    let targetEmail = 'admin@resq.demo'
    if (roleType === 'operator') targetEmail = 'operator@resq.demo'
    else if (roleType === 'viewer') targetEmail = 'viewer@resq.demo'

    setIdentifier(targetEmail)
    setPassword('Resq@2026!')
    setGeneralError('')

    setIsSubmitting(true)
    const result = await login(targetEmail, 'Resq@2026!', true)
    setIsSubmitting(false)

    if (!result.success) {
      setGeneralError(result.error || 'Authentication failed for demo account.')
    }
  }

  return (
    <div className={styles.pageContainer}>
      <div className={styles.bgPattern} />

      <div className={styles.authWrapper}>
        {/* Top Branding */}
        <div className={styles.topBranding}>
          <div className={styles.brandLogoRow}>
            <img
              src="/resq-logo.png"
              alt="resQ Logo"
              style={{ height: '62px', width: 'auto', objectFit: 'contain', mixBlendMode: 'multiply' }}
            />
          </div>
          <div className={styles.brandBadge}>
            <span>Assess</span>
            <span className={styles.dot}>•</span>
            <span>Route</span>
            <span className={styles.dot}>•</span>
            <span>Respond</span>
          </div>
        </div>

        {/* Centered Authentication Card */}
        <div className={styles.authCard}>
          {/* ================= MODE: LOGIN ================= */}
          {mode === 'login' && (
            <>
              <div className={styles.cardHeader}>
                <div className={styles.topSwitchRow}>
                  <span className={styles.topSwitchText}>New to RESQ?</span>
                  <button
                    type="button"
                    className={styles.topSwitchLink}
                    onClick={() => {
                      setMode('register')
                      setStep(1)
                      setGeneralError('')
                    }}
                  >
                    Create account
                  </button>
                </div>
                <h2 className={styles.cardTitle}>Welcome back.</h2>
                <p className={styles.cardSubtitle}>
                  Sign in to continue to your relief operations account.
                </p>
              </div>

              {generalError && (
                <div className={`${styles.alertBanner} ${styles.alertError}`}>
                  <AlertCircle size={16} />
                  <span>{generalError}</span>
                </div>
              )}

              {generalSuccess && (
                <div className={`${styles.alertBanner} ${styles.alertSuccess}`}>
                  <CheckCircle2 size={16} />
                  <span>{generalSuccess}</span>
                </div>
              )}

              <form onSubmit={handleLoginSubmit} className={styles.form}>
                {/* Identifier */}
                <div className={styles.fieldGroup}>
                  <label className={styles.label} htmlFor="login-identifier">
                    Email or mobile number
                  </label>
                  <div className={styles.inputWrapper}>
                    <div className={styles.inputIcon}>
                      <Mail size={16} />
                    </div>
                    <input
                      id="login-identifier"
                      type="text"
                      className={`${styles.input} ${fieldErrors.identifier ? styles.inputError : ''}`}
                      placeholder="e.g. admin@resq.demo or +91 98765 00001"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      autoComplete="username"
                    />
                  </div>
                  {fieldErrors.identifier && (
                    <span className={styles.errorText}>{fieldErrors.identifier}</span>
                  )}
                </div>

                {/* Password */}
                <div className={styles.fieldGroup}>
                  <div className={styles.labelRow}>
                    <label className={styles.label} htmlFor="login-password">
                      Password
                    </label>
                    <button
                      type="button"
                      className={styles.forgotLink}
                      onClick={() => {
                        setMode('forgot')
                        setGeneralError('')
                        setGeneralSuccess('')
                      }}
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className={styles.inputWrapper}>
                    <div className={styles.inputIcon}>
                      <Lock size={16} />
                    </div>
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      className={`${styles.input} ${fieldErrors.password ? styles.inputError : ''}`}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      className={styles.eyeBtn}
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {fieldErrors.password && (
                    <span className={styles.errorText}>{fieldErrors.password}</span>
                  )}
                </div>

                {/* Remember Me Checkbox */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '2px 0' }}>
                  <input
                    id="remember-me-checkbox"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    style={{ cursor: 'pointer', accentColor: '#2563eb', width: '15px', height: '15px' }}
                  />
                  <label
                    htmlFor="remember-me-checkbox"
                    style={{ fontSize: '12.5px', color: '#4b5563', cursor: 'pointer', userSelect: 'none' }}
                  >
                    Remember this terminal (7 days)
                  </label>
                </div>

                {/* Submit Button */}
                <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
                  <span>{isSubmitting ? 'Signing in...' : 'Sign in'}</span>
                  <ArrowRight size={16} />
                </button>
              </form>

              {/* Divider */}
              <div className={styles.divider}>
                <div className={styles.dividerLine} />
                <span className={styles.dividerText}>OR</span>
                <div className={styles.dividerLine} />
              </div>

              {/* Social Login Buttons */}
              <div className={styles.socialButtons}>
                <button
                  type="button"
                  className={styles.socialBtn}
                  onClick={() => handleSocialLogin('google')}
                >
                  <svg className={styles.socialIcon} viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </button>

                <button
                  type="button"
                  className={styles.socialBtn}
                  onClick={() => handleSocialLogin('apple')}
                >
                  <svg className={styles.socialIcon} viewBox="0 0 24 24" fill="#000000">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.63-.77 1.06-1.84.94-2.91-.91.04-2.02.61-2.67 1.38-.58.67-1.08 1.76-.94 2.81 1.02.08 2.04-.51 2.67-1.28z" />
                  </svg>
                  <span>Continue with Apple</span>
                </button>
              </div>

              {/* Bottom Security Note */}
              <div className={styles.bottomSecurityNote}>
                <Shield size={14} />
                <span>
                  We protect your operational information and keep your account secure.
                </span>
              </div>

              {/* Hackathon Evaluator Quick Access */}
              <div className={styles.demoAccessBar}>
                <div className={styles.demoBarTitle}>
                  <Radio size={12} />
                  <span>Quick Demo Access (1-Click Login)</span>
                </div>
                <div className={styles.demoPills}>
                  <button
                    type="button"
                    className={styles.demoPill}
                    onClick={() => handleDemoFill('admin')}
                    disabled={isSubmitting}
                  >
                    Admin
                  </button>
                  <button
                    type="button"
                    className={styles.demoPill}
                    onClick={() => handleDemoFill('operator')}
                    disabled={isSubmitting}
                  >
                    Relief Operator
                  </button>
                  <button
                    type="button"
                    className={styles.demoPill}
                    onClick={() => handleDemoFill('viewer')}
                    disabled={isSubmitting}
                  >
                    Viewer / Monitoring
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ================= MODE: REGISTER (2-STEP) ================= */}
          {mode === 'register' && (
            <>
              {/* Back to login or step 1 */}
              <button
                type="button"
                className={styles.backBtn}
                onClick={() => {
                  if (step === 2) {
                    setStep(1)
                  } else {
                    setMode('login')
                  }
                  setGeneralError('')
                }}
              >
                <ArrowLeft size={14} />
                <span>{step === 2 ? 'Back to basic details' : 'Back to sign in'}</span>
              </button>

              {/* Stepper Progress Bar */}
              <div className={styles.stepperWrapper}>
                <div className={styles.stepperHeader}>
                  <span className={styles.stepperTitle}>Create your account</span>
                  <span className={styles.stepperCount}>Step {step} of 2</span>
                </div>
                <div className={styles.progressBarTrack}>
                  <div
                    className={styles.progressBarFill}
                    style={{ width: step === 1 ? '50%' : '100%' }}
                  />
                </div>
                <div className={styles.stepLabelsRow}>
                  <span className={step === 1 ? styles.stepLabelActive : styles.stepLabelInactive}>
                    1. Basic details
                  </span>
                  <span className={step === 2 ? styles.stepLabelActive : styles.stepLabelInactive}>
                    2. Choose username
                  </span>
                </div>
              </div>

              {generalError && (
                <div className={`${styles.alertBanner} ${styles.alertError}`}>
                  <AlertCircle size={16} />
                  <span>{generalError}</span>
                </div>
              )}

              {/* STEP 1: Basic Details */}
              {step === 1 && (
                <div>
                  <div className={styles.cardHeader} style={{ marginBottom: '16px' }}>
                    <h2 className={styles.cardTitle}>Let&apos;s get started</h2>
                    <p className={styles.cardSubtitle}>
                      Tell us a few details to set up your RESQ operations account.
                    </p>
                  </div>

                  <form onSubmit={handleProceedToStep2} className={styles.form}>
                    {/* Circular Photo Uploader */}
                    <div className={styles.photoUploadSection}>
                      <input
                        type="file"
                        ref={fileInputRef}
                        className={styles.photoInputHidden}
                        accept="image/png,image/jpeg,image/jpg,image/webp"
                        onChange={handlePhotoSelect}
                      />
                      <div
                        className={styles.photoCircle}
                        onClick={() => fileInputRef.current?.click()}
                        title="Click to select profile photo"
                      >
                        {profilePhoto ? (
                          <img src={profilePhoto} alt="Profile Preview" className={styles.photoPreview} />
                        ) : (
                          <Camera size={22} color="#64748b" />
                        )}
                        <div className={styles.photoCameraIcon}>
                          <Camera size={12} />
                        </div>
                      </div>
                      <div className={styles.photoDetails}>
                        <span className={styles.photoLabel}>Profile Photo</span>
                        <span className={styles.photoHint}>JPG, PNG or WEBP (Max 5MB)</span>
                      </div>
                    </div>

                    {/* Full Name */}
                    <div className={styles.fieldGroup}>
                      <label className={styles.label} htmlFor="reg-name">
                        Full Name
                      </label>
                      <div className={styles.inputWrapper}>
                        <div className={styles.inputIcon}>
                          <User size={16} />
                        </div>
                        <input
                          id="reg-name"
                          type="text"
                          className={`${styles.input} ${fieldErrors.fullName ? styles.inputError : ''}`}
                          placeholder="e.g. Prince"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                        />
                      </div>
                      {fieldErrors.fullName && (
                        <span className={styles.errorText}>{fieldErrors.fullName}</span>
                      )}
                    </div>

                    {/* Email */}
                    <div className={styles.fieldGroup}>
                      <label className={styles.label} htmlFor="reg-email">
                        Email Address
                      </label>
                      <div className={styles.inputWrapper}>
                        <div className={styles.inputIcon}>
                          <Mail size={16} />
                        </div>
                        <input
                          id="reg-email"
                          type="email"
                          className={`${styles.input} ${fieldErrors.email ? styles.inputError : ''}`}
                          placeholder="e.g. rahul@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                        />
                      </div>
                      {fieldErrors.email && (
                        <span className={styles.errorText}>{fieldErrors.email}</span>
                      )}
                    </div>

                    {/* Mobile Number */}
                    <div className={styles.fieldGroup}>
                      <label className={styles.label} htmlFor="reg-mobile">
                        Mobile Number (Optional)
                      </label>
                      <div className={styles.inputWrapper}>
                        <div className={styles.inputIcon}>
                          <Phone size={16} />
                        </div>
                        <input
                          id="reg-mobile"
                          type="tel"
                          className={`${styles.input} ${fieldErrors.mobile ? styles.inputError : ''}`}
                          placeholder="e.g. +91 98765 43210"
                          value={mobile}
                          onChange={(e) => setMobile(e.target.value)}
                        />
                      </div>
                      {fieldErrors.mobile && (
                        <span className={styles.errorText}>{fieldErrors.mobile}</span>
                      )}
                    </div>

                    {/* Password */}
                    <div className={styles.fieldGroup}>
                      <label className={styles.label} htmlFor="reg-password">
                        Password
                      </label>
                      <div className={styles.inputWrapper}>
                        <div className={styles.inputIcon}>
                          <Lock size={16} />
                        </div>
                        <input
                          id="reg-password"
                          type={showRegPassword ? 'text' : 'password'}
                          className={`${styles.input} ${fieldErrors.regPassword ? styles.inputError : ''}`}
                          placeholder="Minimum 8 characters"
                          value={regPassword}
                          onChange={(e) => setRegPassword(e.target.value)}
                        />
                        <button
                          type="button"
                          className={styles.eyeBtn}
                          onClick={() => setShowRegPassword(!showRegPassword)}
                          aria-label={showRegPassword ? 'Hide password' : 'Show password'}
                        >
                          {showRegPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      {fieldErrors.regPassword && (
                        <span className={styles.errorText}>{fieldErrors.regPassword}</span>
                      )}
                    </div>

                    {/* Confirm Password */}
                    <div className={styles.fieldGroup}>
                      <label className={styles.label} htmlFor="reg-confirm-password">
                        Confirm Password
                      </label>
                      <div className={styles.inputWrapper}>
                        <div className={styles.inputIcon}>
                          <Lock size={16} />
                        </div>
                        <input
                          id="reg-confirm-password"
                          type={showRegPassword ? 'text' : 'password'}
                          className={`${styles.input} ${fieldErrors.confirmPassword ? styles.inputError : ''}`}
                          placeholder="Re-enter password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                        />
                      </div>
                      {fieldErrors.confirmPassword && (
                        <span className={styles.errorText}>{fieldErrors.confirmPassword}</span>
                      )}
                    </div>

                    {/* Next Button */}
                    <button type="submit" className={styles.submitBtn}>
                      <span>Continue to username</span>
                      <ArrowRight size={16} />
                    </button>
                  </form>
                </div>
              )}

              {/* STEP 2: Choose Username & Role */}
              {step === 2 && (
                <div>
                  <div className={styles.cardHeader} style={{ marginBottom: '16px' }}>
                    <h2 className={styles.cardTitle}>Choose your username</h2>
                    <p className={styles.cardSubtitle}>
                      Pick your unique identifier and operational role in RESQ.
                    </p>
                  </div>

                  <form onSubmit={handleRegisterSubmit} className={styles.form}>
                    {/* Username Field */}
                    <div className={styles.fieldGroup}>
                      <div className={styles.labelRow}>
                        <label className={styles.label} htmlFor="reg-username">
                          Username
                        </label>
                        {usernameStatus.message && (
                          <span
                            className={
                              usernameStatus.available === true
                                ? styles.statusSuccess
                                : usernameStatus.available === false
                                ? styles.statusError
                                : styles.statusChecking
                            }
                          >
                            {usernameStatus.available === true && <Check size={12} />}
                            {usernameStatus.message}
                          </span>
                        )}
                      </div>
                      <div className={styles.inputWrapper}>
                        <div className={styles.inputIcon}>
                          <span style={{ fontSize: '15px', fontWeight: 'bold' }}>@</span>
                        </div>
                        <input
                          id="reg-username"
                          type="text"
                          className={`${styles.input} ${
                            usernameStatus.available === false ? styles.inputError : ''
                          }`}
                          placeholder="e.g. rahul_resq"
                          value={username}
                          onChange={(e) => handleUsernameChange(e.target.value)}
                        />
                      </div>
                      <span className={styles.photoHint}>
                        3-20 characters: letters, numbers, and underscores only.
                      </span>
                    </div>

                    {/* Role Selection */}
                    <div className={styles.fieldGroup}>
                      <label className={styles.label}>Select Operational Role</label>
                      <div className={styles.rolesGrid}>
                        {/* Relief Operator */}
                        <div
                          className={`${styles.roleCard} ${
                            selectedRole === 'Relief Operator' ? styles.roleCardSelected : ''
                          }`}
                          onClick={() => setSelectedRole('Relief Operator')}
                        >
                          <input
                            type="radio"
                            className={styles.roleRadio}
                            name="role"
                            checked={selectedRole === 'Relief Operator'}
                            onChange={() => setSelectedRole('Relief Operator')}
                          />
                          <div className={styles.roleInfo}>
                            <div className={styles.roleTitleRow}>
                              <span className={styles.roleTitle}>Relief Operator</span>
                              <span className={`${styles.roleBadge} ${styles.badgeOperator}`}>
                                Field Operations
                              </span>
                            </div>
                            <span className={styles.roleDesc}>
                              Report damage, coordinate relief convoys, manage routes, and trigger emergency SOS.
                            </span>
                          </div>
                        </div>

                        {/* Monitoring / Viewer */}
                        <div
                          className={`${styles.roleCard} ${
                            selectedRole === 'Monitoring / Viewer' ? styles.roleCardSelected : ''
                          }`}
                          onClick={() => setSelectedRole('Monitoring / Viewer')}
                        >
                          <input
                            type="radio"
                            className={styles.roleRadio}
                            name="role"
                            checked={selectedRole === 'Monitoring / Viewer'}
                            onChange={() => setSelectedRole('Monitoring / Viewer')}
                          />
                          <div className={styles.roleInfo}>
                            <div className={styles.roleTitleRow}>
                              <span className={styles.roleTitle}>Monitoring / Viewer</span>
                              <span className={`${styles.roleBadge} ${styles.badgeViewer}`}>
                                Observer Clearance
                              </span>
                            </div>
                            <span className={styles.roleDesc}>
                              Read-only access to live 3D Digital Twin, GIS map layers, and risk intelligence.
                            </span>
                          </div>
                        </div>
                      </div>
                      <span className={styles.adminNotice}>
                        * Administrator accounts are centrally provisioned by Disaster Command.
                      </span>
                    </div>

                    {/* Create Account Button */}
                    <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
                      <span>{isSubmitting ? 'Creating RESQ account...' : 'Create RESQ account'}</span>
                      <ArrowRight size={16} />
                    </button>
                  </form>
                </div>
              )}
            </>
          )}

          {/* ================= MODE: FORGOT PASSWORD ================= */}
          {mode === 'forgot' && (
            <>
              <button
                type="button"
                className={styles.backBtn}
                onClick={() => {
                  setMode('login')
                  setGeneralError('')
                  setGeneralSuccess('')
                }}
              >
                <ArrowLeft size={14} />
                <span>Back to sign in</span>
              </button>

              <div className={styles.cardHeader}>
                <h2 className={styles.cardTitle}>Reset password</h2>
                <p className={styles.cardSubtitle}>
                  Enter your email or mobile number to receive a secure recovery token.
                </p>
              </div>

              {generalError && (
                <div className={`${styles.alertBanner} ${styles.alertError}`}>
                  <AlertCircle size={16} />
                  <span>{generalError}</span>
                </div>
              )}

              {generalSuccess && (
                <div className={`${styles.alertBanner} ${styles.alertSuccess}`}>
                  <CheckCircle2 size={16} />
                  <span>{generalSuccess}</span>
                </div>
              )}

              <form onSubmit={handleForgotSubmit} className={styles.form}>
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Email or mobile number</label>
                  <div className={styles.inputWrapper}>
                    <div className={styles.inputIcon}>
                      <Mail size={16} />
                    </div>
                    <input
                      type="text"
                      className={styles.input}
                      placeholder="e.g. admin@resq.demo or +91 98765 00001"
                      value={forgotIdentifier}
                      onChange={(e) => setForgotIdentifier(e.target.value)}
                    />
                  </div>
                </div>

                <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
                  <span>{isSubmitting ? 'Sending...' : 'Generate Reset Link'}</span>
                  <ArrowRight size={16} />
                </button>
              </form>

              {devResetLink && (
                <div style={{ marginTop: '16px', padding: '12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', fontSize: '12px' }}>
                  <strong>Dev Testing Link:</strong>
                  <div style={{ wordBreak: 'break-all', marginTop: '4px', color: '#1e40af' }}>
                    Reset token generated: <code>{resetToken.slice(0, 16)}...</code>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMode('reset')}
                    style={{ marginTop: '8px', background: '#2563eb', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '11.5px', fontWeight: '600' }}
                  >
                    Proceed to Reset Form →
                  </button>
                </div>
              )}
            </>
          )}

          {/* ================= MODE: RESET PASSWORD ================= */}
          {mode === 'reset' && (
            <>
              <div className={styles.cardHeader}>
                <h2 className={styles.cardTitle}>Set new password</h2>
                <p className={styles.cardSubtitle}>
                  Enter your new secure password (min 8 characters).
                </p>
              </div>

              {generalError && (
                <div className={`${styles.alertBanner} ${styles.alertError}`}>
                  <AlertCircle size={16} />
                  <span>{generalError}</span>
                </div>
              )}

              {generalSuccess && (
                <div className={`${styles.alertBanner} ${styles.alertSuccess}`}>
                  <CheckCircle2 size={16} />
                  <span>{generalSuccess}</span>
                </div>
              )}

              <form onSubmit={handleResetSubmit} className={styles.form}>
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>New Password</label>
                  <div className={styles.inputWrapper}>
                    <div className={styles.inputIcon}>
                      <Lock size={16} />
                    </div>
                    <input
                      type="password"
                      className={styles.input}
                      placeholder="Minimum 8 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </div>
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Confirm New Password</label>
                  <div className={styles.inputWrapper}>
                    <div className={styles.inputIcon}>
                      <Lock size={16} />
                    </div>
                    <input
                      type="password"
                      className={styles.input}
                      placeholder="Re-enter new password"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                    />
                  </div>
                </div>

                <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
                  <span>{isSubmitting ? 'Updating...' : 'Update Password & Sign In'}</span>
                  <ArrowRight size={16} />
                </button>
              </form>
            </>
          )}
        </div>

        {/* Emergency Hotline Footer */}
        <div className={styles.emergencyHotlineFooter}>
          Emergency Control Helpline: 1070 / 1079 • Assam State Disaster Management Authority (ASDMA)
        </div>
      </div>
    </div>
  )
}

export default LoginView
