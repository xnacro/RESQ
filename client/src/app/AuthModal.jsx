// In-Dashboard Frosted Glassmorphism Authentication Modal for RESQ Command Center

import { useState, useRef, useEffect } from 'react'
import {
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
  X,
  Radio,
  Check,
  Sparkles,
} from 'lucide-react'
import { useAuth } from './authContext.jsx'
import styles from './AuthModal.module.css'

export function AuthModal() {
  const {
    isAuthModalOpen,
    authModalMode,
    closeAuthModal,
    login,
    register,
    switchDemoRole,
  } = useAuth()

  const [mode, setMode] = useState('login') // 'login' | 'register' | 'forgot' | 'reset'
  const [step, setStep] = useState(1) // 1 | 2 for register

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
  const [selectedRole, setSelectedRole] = useState('Relief Operator')
  const usernameCheckTimerRef = useRef(null)

  // Forgot password state
  const [forgotIdentifier, setForgotIdentifier] = useState('')

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [generalError, setGeneralError] = useState('')
  const [generalSuccess, setGeneralSuccess] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})

  // Sync mode when modal opens
  useEffect(() => {
    if (isAuthModalOpen) {
      setMode(authModalMode || 'login')
      setStep(1)
      setGeneralError('')
      setGeneralSuccess('')
      setFieldErrors({})
    }
  }, [isAuthModalOpen, authModalMode])

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

  // Real-time username availability check (debounced)
  const handleUsernameChange = (e) => {
    const raw = e.target.value.replace(/^@/, '')
    const clean = raw.toLowerCase().replace(/[^a-z0-9_]/g, '')
    setUsername(clean)

    if (usernameCheckTimerRef.current) {
      clearTimeout(usernameCheckTimerRef.current)
    }

    if (clean.length < 3) {
      setUsernameStatus({ checking: false, available: null, message: 'Minimum 3 characters' })
      return
    }

    setUsernameStatus({ checking: true, available: null, message: 'Checking availability...' })

    usernameCheckTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/auth/check-username?username=${encodeURIComponent(clean)}`)
        const data = await res.json()
        if (data.available) {
          setUsernameStatus({ checking: false, available: true, message: 'Username is available' })
        } else {
          setUsernameStatus({ checking: false, available: false, message: data.error || 'Username is taken' })
        }
      } catch {
        setUsernameStatus({ checking: false, available: null, message: 'Unable to verify username' })
      }
    }, 400)
  }

  // Password validation
  const validateStep1 = () => {
    const errors = {}
    if (!fullName.trim()) errors.fullName = 'Full name is required'
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) errors.email = 'Valid email address is required'
    if (!regPassword) {
      errors.regPassword = 'Password is required'
    } else if (regPassword.length < 8) {
      errors.regPassword = 'Password must be at least 8 characters'
    }
    if (regPassword !== confirmPassword) errors.confirmPassword = 'Passwords do not match'
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleStep1Submit = (e) => {
    e.preventDefault()
    setGeneralError('')
    if (validateStep1()) {
      if (!username) {
        const generated = email.split('@')[0].replace(/[^a-z0-9_]/g, '_').toLowerCase()
        setUsername(generated)
      }
      setStep(2)
    }
  }

  // Final registration submission
  const handleRegisterSubmit = async (e) => {
    e.preventDefault()
    setGeneralError('')
    setIsSubmitting(true)

    try {
      const res = await register({
        fullName: fullName.trim(),
        name: fullName.trim(),
        email: email.trim(),
        mobile: mobile.trim() || null,
        username: username.trim() || null,
        profilePhoto,
        password: regPassword,
        role: selectedRole,
        department: selectedRole === 'Relief Operator' ? 'Field Logistics & Convoy Operations' : 'Regional Disaster Research & Analytics',
      })

      if (!res.success) {
        setGeneralError(res.error || 'Registration failed.')
      }
    } catch (err) {
      setGeneralError(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Login submission
  const handleLoginSubmit = async (e) => {
    e.preventDefault()
    setGeneralError('')
    if (!identifier.trim() || !password) {
      setGeneralError('Please enter your identifier and password.')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await login(identifier.trim(), password, rememberMe)
      if (!res.success) {
        setGeneralError(res.error || 'Invalid credentials.')
      }
    } catch (err) {
      setGeneralError(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  // One-click demo role login
  const handleDemoLogin = async (roleName) => {
    setGeneralError('')
    setIsSubmitting(true)
    try {
      const res = await switchDemoRole(roleName)
      if (!res.success) {
        setGeneralError(res.error || 'Failed to authenticate demo account.')
      }
    } catch (err) {
      setGeneralError(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Forgot password request
  const handleForgotSubmit = async (e) => {
    e.preventDefault()
    if (!forgotIdentifier.trim()) {
      setGeneralError('Please enter your registered email address or mobile.')
      return
    }

    setIsSubmitting(true)
    setGeneralError('')
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: forgotIdentifier.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        setGeneralSuccess(data.message || 'Password reset instructions generated.')
      } else {
        setGeneralError(data.error || 'Failed to send reset link.')
      }
    } catch (err) {
      setGeneralError(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isAuthModalOpen) return null

  return (
    <div className={styles.modalBackdrop} onClick={closeAuthModal}>
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        {/* Header Strip */}
        <div className={styles.modalHeader}>
          <div className={styles.brandRow}>
            <div className={styles.brandBadge}>
              <Radio size={14} className={styles.brandPulse} />
              <span>RESQ COMMAND AUTH</span>
            </div>
            <button
              type="button"
              className={styles.closeBtn}
              onClick={closeAuthModal}
              aria-label="Close authentication modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* One-Click Hackathon Evaluator Quick Access */}
        <div className={styles.quickAccessBox}>
          <div className={styles.quickAccessLabel}>
            <Sparkles size={13} className={styles.sparkleIcon} />
            <span>One-Click Demo Roles (Hackathon Evaluation)</span>
          </div>
          <div className={styles.demoRolesGrid}>
            <button
              type="button"
              className={styles.demoRoleBtn}
              onClick={() => handleDemoLogin('ADMIN')}
              disabled={isSubmitting}
            >
              <span className={styles.roleTagAdmin}>ADMIN</span>
              <span className={styles.roleName}>Commander Rajesh</span>
            </button>
            <button
              type="button"
              className={styles.demoRoleBtn}
              onClick={() => handleDemoLogin('OPERATOR')}
              disabled={isSubmitting}
            >
              <span className={styles.roleTagOperator}>OPERATOR</span>
              <span className={styles.roleName}>Rahul Kumar</span>
            </button>
            <button
              type="button"
              className={styles.demoRoleBtn}
              onClick={() => handleDemoLogin('VIEWER')}
              disabled={isSubmitting}
            >
              <span className={styles.roleTagViewer}>VIEWER</span>
              <span className={styles.roleName}>Dr. Ananya Roy</span>
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        {mode !== 'forgot' && (
          <div className={styles.tabSwitcher}>
            <button
              type="button"
              className={`${styles.tabBtn} ${mode === 'login' ? styles.tabBtnActive : ''}`}
              onClick={() => {
                setMode('login')
                setGeneralError('')
                setGeneralSuccess('')
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`${styles.tabBtn} ${mode === 'register' ? styles.tabBtnActive : ''}`}
              onClick={() => {
                setMode('register')
                setStep(1)
                setGeneralError('')
                setGeneralSuccess('')
              }}
            >
              Create Account
            </button>
          </div>
        )}

        {/* Notices */}
        {generalError && (
          <div className={styles.errorBanner}>
            <AlertCircle size={15} />
            <span>{generalError}</span>
          </div>
        )}
        {generalSuccess && (
          <div className={styles.successBanner}>
            <CheckCircle2 size={15} />
            <span>{generalSuccess}</span>
          </div>
        )}

        {/* 1. SIGN IN FORM */}
        {mode === 'login' && (
          <form className={styles.formRoot} onSubmit={handleLoginSubmit}>
            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Email, Username, or Mobile</label>
              <div className={styles.inputWrap}>
                <User size={16} className={styles.inputIcon} />
                <input
                  type="text"
                  className={styles.inputField}
                  placeholder="admin@resq.demo or @rahul_resq"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className={styles.inputGroup}>
              <div className={styles.labelRow}>
                <label className={styles.inputLabel}>Password</label>
                <button
                  type="button"
                  className={styles.forgotLink}
                  onClick={() => {
                    setMode('forgot')
                    setGeneralError('')
                  }}
                >
                  Forgot password?
                </button>
              </div>
              <div className={styles.inputWrap}>
                <Lock size={16} className={styles.inputIcon} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  className={styles.inputField}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className={styles.togglePasswordBtn}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className={styles.checkboxRow}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>Remember this terminal (7 days)</span>
              </label>
            </div>

            <button type="submit" className={styles.primarySubmitBtn} disabled={isSubmitting}>
              <span>{isSubmitting ? 'Authenticating...' : 'Sign In to Command Center'}</span>
              <ArrowRight size={16} />
            </button>
          </form>
        )}

        {/* 2. CREATE ACCOUNT 2-STEP FORM */}
        {mode === 'register' && step === 1 && (
          <form className={styles.formRoot} onSubmit={handleStep1Submit}>
            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Full Name</label>
              <div className={styles.inputWrap}>
                <User size={16} className={styles.inputIcon} />
                <input
                  type="text"
                  className={styles.inputField}
                  placeholder="e.g. Rahul Kumar"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
              {fieldErrors.fullName && <span className={styles.fieldError}>{fieldErrors.fullName}</span>}
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Official Email Address</label>
              <div className={styles.inputWrap}>
                <Mail size={16} className={styles.inputIcon} />
                <input
                  type="email"
                  className={styles.inputField}
                  placeholder="name@disaster.assam.gov.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              {fieldErrors.email && <span className={styles.fieldError}>{fieldErrors.email}</span>}
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Mobile Number (Emergency SMS)</label>
              <div className={styles.inputWrap}>
                <Phone size={16} className={styles.inputIcon} />
                <input
                  type="tel"
                  className={styles.inputField}
                  placeholder="+91 98765 43210"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                />
              </div>
            </div>

            <div className={styles.grid2Col}>
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Password</label>
                <div className={styles.inputWrap}>
                  <Lock size={15} className={styles.inputIcon} />
                  <input
                    type={showRegPassword ? 'text' : 'password'}
                    className={styles.inputField}
                    placeholder="Min. 8 chars"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className={styles.togglePasswordBtn}
                    onClick={() => setShowRegPassword(!showRegPassword)}
                  >
                    {showRegPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {fieldErrors.regPassword && <span className={styles.fieldError}>{fieldErrors.regPassword}</span>}
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Confirm</label>
                <div className={styles.inputWrap}>
                  <Lock size={15} className={styles.inputIcon} />
                  <input
                    type={showRegPassword ? 'text' : 'password'}
                    className={styles.inputField}
                    placeholder="Repeat password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
                {fieldErrors.confirmPassword && (
                  <span className={styles.fieldError}>{fieldErrors.confirmPassword}</span>
                )}
              </div>
            </div>

            <button type="submit" className={styles.primarySubmitBtn}>
              <span>Next: Mission Credentials</span>
              <ArrowRight size={16} />
            </button>
          </form>
        )}

        {/* Register Step 2: Username & Role */}
        {mode === 'register' && step === 2 && (
          <form className={styles.formRoot} onSubmit={handleRegisterSubmit}>
            <div className={styles.avatarPickerRow}>
              <div
                className={styles.avatarPreviewBox}
                onClick={() => fileInputRef.current?.click()}
                title="Upload profile photo"
              >
                {profilePhoto ? (
                  <img src={profilePhoto} alt="Profile" className={styles.avatarImg} />
                ) : (
                  <div className={styles.avatarPlaceholder}>
                    <Camera size={22} />
                    <span>Upload Photo</span>
                  </div>
                )}
              </div>
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept="image/png, image/jpeg, image/webp"
                onChange={handlePhotoSelect}
              />
              <div className={styles.avatarHelpCol}>
                <span className={styles.avatarHelpTitle}>Personnel Identity Photo</span>
                <span className={styles.avatarHelpText}>PNG, JPG or WEBP under 5MB.</span>
              </div>
            </div>

            <div className={styles.inputGroup}>
              <div className={styles.labelRow}>
                <label className={styles.inputLabel}>Personnel Call-Sign / Username</label>
                {usernameStatus.message && (
                  <span
                    className={
                      usernameStatus.available === true
                        ? styles.statusAvailable
                        : usernameStatus.available === false
                        ? styles.statusTaken
                        : styles.statusChecking
                    }
                  >
                    {usernameStatus.available === true && <Check size={11} />}
                    {usernameStatus.message}
                  </span>
                )}
              </div>
              <div className={styles.inputWrap}>
                <span className={styles.atSymbol}>@</span>
                <input
                  type="text"
                  className={styles.inputField}
                  placeholder="rahul_resq"
                  value={username}
                  onChange={handleUsernameChange}
                  required
                />
              </div>
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Assign Operational Role</label>
              <div className={styles.roleSelectGrid}>
                <div
                  className={`${styles.roleOptionCard} ${
                    selectedRole === 'Relief Operator' ? styles.roleOptionActive : ''
                  }`}
                  onClick={() => setSelectedRole('Relief Operator')}
                >
                  <div className={styles.roleOptionHeader}>
                    <Radio size={14} className={styles.roleIconOperator} />
                    <span className={styles.roleOptionTitle}>Relief Operator</span>
                  </div>
                  <span className={styles.roleOptionDesc}>
                    Field convoy routing, bridge blockage reports, SOS dispatch.
                  </span>
                </div>

                <div
                  className={`${styles.roleOptionCard} ${
                    selectedRole === 'Monitoring / Viewer' ? styles.roleOptionActive : ''
                  }`}
                  onClick={() => setSelectedRole('Monitoring / Viewer')}
                >
                  <div className={styles.roleOptionHeader}>
                    <Eye size={14} className={styles.roleIconViewer} />
                    <span className={styles.roleOptionTitle}>Monitoring Analyst</span>
                  </div>
                  <span className={styles.roleOptionDesc}>
                    Read-only spatial grid analysis and disaster intelligence.
                  </span>
                </div>
              </div>
            </div>

            <div className={styles.stepBtnRow}>
              <button
                type="button"
                className={styles.backStepBtn}
                onClick={() => setStep(1)}
                disabled={isSubmitting}
              >
                <ArrowLeft size={16} />
                <span>Back</span>
              </button>

              <button type="submit" className={styles.primarySubmitBtn} disabled={isSubmitting}>
                <span>{isSubmitting ? 'Creating Account...' : 'Complete & Launch'}</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </form>
        )}

        {/* 3. FORGOT PASSWORD FORM */}
        {mode === 'forgot' && (
          <form className={styles.formRoot} onSubmit={handleForgotSubmit}>
            <p className={styles.forgotSubtitle}>
              Enter your registered email address or mobile phone. We will generate password recovery instructions.
            </p>

            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Email or Mobile Number</label>
              <div className={styles.inputWrap}>
                <Mail size={16} className={styles.inputIcon} />
                <input
                  type="text"
                  className={styles.inputField}
                  placeholder="admin@resq.demo"
                  value={forgotIdentifier}
                  onChange={(e) => setForgotIdentifier(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className={styles.stepBtnRow}>
              <button
                type="button"
                className={styles.backStepBtn}
                onClick={() => {
                  setMode('login')
                  setGeneralError('')
                  setGeneralSuccess('')
                }}
                disabled={isSubmitting}
              >
                <ArrowLeft size={16} />
                <span>Back to Sign In</span>
              </button>

              <button type="submit" className={styles.primarySubmitBtn} disabled={isSubmitting}>
                <span>{isSubmitting ? 'Sending...' : 'Send Reset Link'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export default AuthModal
