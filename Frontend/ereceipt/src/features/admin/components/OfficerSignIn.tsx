import React, { useState, useEffect } from 'react';
import {
  Eye,
  EyeOff,
  AlertCircle,
  ShieldCheck,
  CheckCircle2,
  RotateCw,
  ArrowLeft,
} from 'lucide-react';
import styles from './OfficerSignIn.module.css';
import { API_BASE_URL } from '../../../config/api';

async function postOfficerAuth(endpoint: string, payload: any) {
  const primaryUrl = `${API_BASE_URL}${endpoint}`;
  try {
    const res = await fetch(primaryUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      throw new Error(data.error || data.message || `HTTP ${res.status}: Request failed.`);
    }
    return data;
  } catch (primaryErr: any) {
    if (primaryUrl.startsWith('http')) {
      try {
        const fallbackRes = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const fallbackData = await fallbackRes.json().catch(() => ({}));
        if (!fallbackRes.ok || !fallbackData.success) {
          throw new Error(fallbackData.error || fallbackData.message || `HTTP ${fallbackRes.status}`);
        }
        return fallbackData;
      } catch {
        // Fall through
      }
    }
    throw primaryErr;
  }
}

interface OfficerSignInProps {
  onSuccess: (officer?: any) => void;
  onReturnToMerchant?: () => void;
}

export const OfficerSignIn: React.FC<OfficerSignInProps> = ({
  onSuccess,
  onReturnToMerchant,
}) => {
  const [authMode, setAuthMode] = useState<'signin' | 'register'>('signin');

  // Sign In state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberOfficer, setRememberOfficer] = useState(false);
  const [isFormReady, setIsFormReady] = useState(false);

  // 2FA state
  const [is2FA, setIs2FA] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [twoFaCode, setTwoFaCode] = useState('');
  const [twoFaCooldown, setTwoFaCooldown] = useState(45);
  const [isResending2FA, setIsResending2FA] = useState(false);
  const [twoFaSuccessNotice, setTwoFaSuccessNotice] = useState<string | null>(null);

  // Countdown timer for 2FA resend
  useEffect(() => {
    if (!is2FA || twoFaCooldown <= 0) return;
    const interval = setInterval(() => {
      setTwoFaCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [is2FA, twoFaCooldown]);

  useEffect(() => {
    setUsername('');
    setPassword('');
    const timer = setTimeout(() => {
      setIsFormReady(true);
    }, 150);
    return () => clearTimeout(timer);
  }, [authMode]);

  // Registration state
  const [regFullName, setRegFullName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regBadgeNumber, setRegBadgeNumber] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regBranch, setRegBranch] = useState('Addis Ababa Large Taxpayers Branch');
  const [regRole, setRegRole] = useState<'REVENUE_OFFICER' | 'SENIOR_AUDITOR' | 'ADMIN'>('REVENUE_OFFICER');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [certifyAuthorized, setCertifyAuthorized] = useState(false);

  // Common state
  const [authError, setAuthError] = useState('');
  const [regSuccessNotice, setRegSuccessNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Handle Sign In submission
  const submitSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    if (!username.trim() || !password) {
      setAuthError('Please enter your username and password.');
      return;
    }

    setIsLoading(true);

    try {
      const data = await postOfficerAuth('/api/admin/auth/login', {
        username: username.trim(),
        password,
        rememberMe: rememberOfficer,
      });

      // Check if 2FA is required
      if (data.data?.requires2FA) {
        setIs2FA(true);
        setTempToken(data.data.tempToken);
        setMaskedEmail(data.data.maskedEmail || data.data.email || 'your official email');
        setTwoFaCooldown(45);
        const code = data.data.code || data.data.simulatedCode || '';
        if (code) {
          setTwoFaCode(code);
          setTwoFaSuccessNotice(`Simulation Mode: Your 2FA security code is ${code}`);
        } else {
          setTwoFaCode('');
        }
        setAuthError('');
        return;
      }

      if (data.data?.token) {
        localStorage.setItem('officer_token', data.data.token);
        localStorage.setItem('officer_user', JSON.stringify(data.data.officer));
      }
      onSuccess(data.data?.officer);
    } catch (err: any) {
      setAuthError(err.message || 'Invalid username or password.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle 2FA verification submission
  const submit2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    if (!twoFaCode || twoFaCode.trim().length !== 6) {
      setAuthError('Please enter the 6-digit verification code.');
      return;
    }

    setIsLoading(true);

    try {
      const data = await postOfficerAuth('/api/admin/auth/verify-2fa', {
        tempToken,
        code: twoFaCode.trim(),
      });

      if (data.data?.token) {
        localStorage.setItem('officer_token', data.data.token);
        localStorage.setItem('officer_user', JSON.stringify(data.data.officer));
      }
      onSuccess(data.data?.officer);
    } catch (err: any) {
      setAuthError(err.message || 'Verification failed. Please check the code.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle 2FA Resend code
  const handleResend2FA = async () => {
    if (twoFaCooldown > 0 || isResending2FA) return;
    setIsResending2FA(true);
    setAuthError('');
    setTwoFaSuccessNotice(null);

    try {
      const data = await postOfficerAuth('/api/admin/auth/resend-2fa', { tempToken });

      setTwoFaCooldown(data.data?.cooldownSeconds || 45);
      const code = data.data?.code || data.data?.simulatedCode;
      if (code) {
        setTwoFaCode(code);
        setTwoFaSuccessNotice(`Simulation Mode: Fresh security code is ${code}`);
      } else {
        setTwoFaSuccessNotice('A new security verification code has been sent to your email.');
      }
    } catch (err: any) {
      setAuthError(err.message || 'Failed to resend code.');
    } finally {
      setIsResending2FA(false);
    }
  };

  // Handle Admin Registration submission
  const submitRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    const cleanName = regFullName.trim();
    const cleanUser = regUsername.trim();
    const cleanBadge = regBadgeNumber.trim().toUpperCase();
    const cleanMail = regEmail.trim();

    if (!cleanName || !cleanUser || !cleanBadge || !cleanMail || !regPassword) {
      setAuthError('All fields marked with an asterisk are required.');
      return;
    }

    if (cleanName.length < 3) {
      setAuthError('Full name must be at least 3 characters long.');
      return;
    }

    if (!/^[a-zA-Z0-9._-]{3,30}$/.test(cleanUser)) {
      setAuthError('Officer username must be 3-30 characters with letters, numbers, dots or underscores.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanMail)) {
      setAuthError('Please enter a valid official email address (e.g., officer@mor.gov.et).');
      return;
    }

    if (cleanBadge.length < 3) {
      setAuthError('Officer badge number or employee ID must be at least 3 characters.');
      return;
    }

    if (regPassword.length < 6) {
      setAuthError('Password must contain at least 6 characters.');
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setAuthError('Passwords do not match. Please re-enter your password.');
      return;
    }

    if (!certifyAuthorized) {
      setAuthError('Please certify that you are an authorized Ministry of Revenues officer.');
      return;
    }

    setIsLoading(true);

    try {
      const data = await postOfficerAuth('/api/admin/auth/register', {
        fullName: regFullName.trim(),
        username: regUsername.trim(),
        badgeNumber: regBadgeNumber.trim().toUpperCase(),
        email: regEmail.trim(),
        branch: regBranch,
        role: regRole,
        password: regPassword,
      });

      setRegSuccessNotice('✓ Officer registered successfully! Connecting to workspace...');

      if (data.data?.token) {
        localStorage.setItem('officer_token', data.data.token);
        localStorage.setItem('officer_user', JSON.stringify(data.data.officer));
      }
      setTimeout(() => {
        onSuccess(data.data?.officer);
      }, 400);
    } catch (err: any) {
      setAuthError(err.message || 'Officer registration failed. Please check your information.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      {/* Left Form Column */}
      <main className={styles.leftColumn}>
        <div className={styles.brandRow}>
          <button
            type="button"
            onClick={onReturnToMerchant}
            className={styles.brandButton}
            title="Return to Merchant Workspace"
          >
            <img
              src="/logo.png"
              alt="eReceipt - Digital Receipts. A Stronger Ethiopia."
              style={{ height: '38px', width: 'auto', objectFit: 'contain', display: 'block' }}
            />
          </button>

          {/* Mode Switcher Tabs */}
          {!is2FA && (
            <div className={styles.tabSwitcher}>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('signin');
                  setAuthError('');
                }}
                className={`${styles.tabSwitchBtn} ${authMode === 'signin' ? styles.tabSwitchBtnActive : ''}`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('register');
                  setAuthError('');
                }}
                className={`${styles.tabSwitchBtn} ${authMode === 'register' ? styles.tabSwitchBtnActive : ''}`}
              >
                Officer Registration
              </button>
            </div>
          )}
        </div>

        <div className={styles.formBox}>
          {is2FA ? (
            /* ================= 2FA VERIFICATION FORM ================= */
            <>
              <button
                type="button"
                onClick={() => {
                  setIs2FA(false);
                  setAuthError('');
                  setTwoFaSuccessNotice(null);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'none',
                  border: 'none',
                  color: '#475569',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0,
                  marginBottom: '16px',
                }}
              >
                <ArrowLeft size={16} /> Back to Sign In
              </button>

              <p className={styles.preTitle}>SECURITY VERIFICATION</p>
              <h1 className={styles.title}>Two-Factor Authentication</h1>
              <p className={styles.description}>
                To comply with Ministry security protocols, a 6-digit verification code has been sent to:
                <br />
                <span style={{ color: '#0F172A', fontWeight: 600 }}>{maskedEmail}</span>
              </p>

              <form onSubmit={submit2FA} className={styles.form}>
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel} htmlFor="officer-2fa-input">
                    Enter 6-Digit Security Code
                  </label>
                  <input
                    id="officer-2fa-input"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    autoFocus
                    value={twoFaCode}
                    onChange={(e) => {
                      const clean = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setTwoFaCode(clean);
                      setAuthError('');
                    }}
                    placeholder="••••••"
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      fontSize: '28px',
                      fontWeight: 800,
                      letterSpacing: '12px',
                      textAlign: 'center',
                      fontFamily: 'monospace',
                      borderRadius: '8px',
                      border: authError ? '1.5px solid #EF4444' : '1.5px solid #CBD5E1',
                      outline: 'none',
                      boxSizing: 'border-box',
                      backgroundColor: '#F8FAFC',
                    }}
                  />
                </div>

                {authError && (
                  <div role="alert" className={styles.errorMessage}>
                    <AlertCircle size={17} style={{ flexShrink: 0 }} />
                    <span>{authError}</span>
                  </div>
                )}

                {twoFaSuccessNotice && !authError && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 14px',
                      backgroundColor: '#F0FDF4',
                      border: '1px solid #BBF7D0',
                      borderRadius: '6px',
                      color: '#15803D',
                      fontSize: '13px',
                      marginBottom: '16px',
                    }}
                  >
                    <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
                    <span>{twoFaSuccessNotice}</span>
                  </div>
                )}

                {/* Resend Cooldown Action */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    margin: '8px 0 16px 0',
                    fontSize: '13px',
                  }}
                >
                  <span style={{ color: '#64748B' }}>Didn't receive email?</span>
                  {twoFaCooldown > 0 ? (
                    <span style={{ color: '#94A3B8', fontWeight: 500 }}>
                      Resend in {twoFaCooldown}s
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResend2FA}
                      disabled={isResending2FA}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#176B4D',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: 0,
                      }}
                    >
                      <RotateCw size={14} className={isResending2FA ? 'spin' : ''} />
                      {isResending2FA ? 'Sending...' : 'Resend code'}
                    </button>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isLoading || twoFaCode.length !== 6}
                  className={styles.submitBtn}
                >
                  {isLoading ? 'Verifying...' : 'Verify & Enter Admin Console'}
                </button>
              </form>
            </>
          ) : authMode === 'signin' ? (
            /* ================= SIGN IN FORM ================= */
            <>
              <p className={styles.preTitle}>REVENUE ADMINISTRATION</p>
              <h1 className={styles.title}>Revenue Officer Sign In</h1>
              <p className={styles.description}>
                Sign in to manage merchant verification, tax reconciliations, and audit records.
              </p>

              {/* Quick Demo Credentials Box */}
              <div
                style={{
                  backgroundColor: '#F0FDF4',
                  border: '1px solid #BBF7D0',
                  borderRadius: '6px',
                  padding: '12px 14px',
                  marginBottom: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#166534',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <ShieldCheck size={16} /> Quick Demo Officer Sign In
                </div>
                <p style={{ margin: 0, fontSize: '11px', color: '#15803D' }}>
                  Click to fill pre-accredited officer credentials:
                </p>
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setUsername('officer.fani');
                      setPassword('Password123');
                      setIsFormReady(true);
                      setAuthError('');
                    }}
                    style={{
                      padding: '5px 10px',
                      fontSize: '11px',
                      fontWeight: 600,
                      backgroundColor: '#176B4D',
                      color: '#FFF',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    Fanuel (officer.fani)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUsername('officer.demo');
                      setPassword('Revenue123');
                      setIsFormReady(true);
                      setAuthError('');
                    }}
                    style={{
                      padding: '5px 10px',
                      fontSize: '11px',
                      fontWeight: 600,
                      backgroundColor: '#E2E8F0',
                      color: '#1E293B',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    Abebe (officer.demo)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUsername('admin');
                      setPassword('Admin123');
                      setIsFormReady(true);
                      setAuthError('');
                    }}
                    style={{
                      padding: '5px 10px',
                      fontSize: '11px',
                      fontWeight: 600,
                      backgroundColor: '#F1F5F9',
                      color: '#334155',
                      border: '1px solid #CBD5E1',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    Admin (admin)
                  </button>
                </div>
              </div>

              <form onSubmit={submitSignIn} className={styles.form} autoComplete="off">
                {/* Browser credential autofill trap */}
                <input
                  type="text"
                  name="fake_officer_user"
                  style={{ position: 'absolute', opacity: 0, height: 0, width: 0, pointerEvents: 'none' }}
                  tabIndex={-1}
                  aria-hidden="true"
                />
                <input
                  type="password"
                  name="fake_officer_pass"
                  style={{ position: 'absolute', opacity: 0, height: 0, width: 0, pointerEvents: 'none' }}
                  tabIndex={-1}
                  aria-hidden="true"
                />

                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel} htmlFor="officer-identifier">
                    Username
                  </label>
                  <input
                    id="officer-identifier"
                    name="officer_acc_code"
                    type="text"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      setAuthError('');
                    }}
                    onFocus={() => setIsFormReady(true)}
                    readOnly={!isFormReady}
                    className={`${styles.input} ${authError ? styles.inputError : ''}`}
                    placeholder="Officer username"
                    autoComplete="off"
                  />
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel} htmlFor="officer-credential">
                    Password
                  </label>
                  <span className={styles.passwordWrapper}>
                    <input
                      id="officer-credential"
                      name="officer_sec_token"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setAuthError('');
                      }}
                      onFocus={() => setIsFormReady(true)}
                      readOnly={!isFormReady}
                      type={showPassword ? 'text' : 'password'}
                      className={`${styles.input} ${authError ? styles.inputError : ''}`}
                      placeholder="Enter password"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className={styles.eyeButton}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </span>
                </div>

                {authError && (
                  <div role="alert" className={styles.errorMessage}>
                    <AlertCircle size={17} style={{ flexShrink: 0 }} />
                    <span>{authError}</span>
                  </div>
                )}

                <div className={styles.optionsRow}>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={rememberOfficer}
                      onChange={(e) => setRememberOfficer(e.target.checked)}
                      className={styles.checkbox}
                    />
                    <span>Remember me</span>
                  </label>
                  <button
                    type="button"
                    className={styles.forgotLink}
                    onClick={() => alert('Please contact the Ministry system administrator to reset your credentials.')}
                  >
                    Forgot Password?
                  </button>
                </div>

                <button type="submit" disabled={isLoading} className={styles.submitBtn}>
                  {isLoading ? 'Signing In...' : 'Sign In as Officer'}
                </button>
              </form>

              <div className={styles.switchPromptBox}>
                <span>Need authorized officer access? </span>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('register');
                    setAuthError('');
                  }}
                  className={styles.switchInlineBtn}
                >
                  Register new officer profile
                </button>
              </div>
            </>
          ) : (
            /* ================= REGISTRATION FORM ================= */
            <>
              <p className={styles.preTitle}>OFFICER ACCREDITATION</p>
              <h1 className={styles.title}>Admin & Officer Registration</h1>
              <p className={styles.description}>
                Create an official administrative profile to review merchant registrations and inspect fiscal records.
              </p>

              <form onSubmit={submitRegistration} className={styles.form}>
                <div className={styles.gridTwoCols}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel} htmlFor="reg-fullname">
                      Full Name *
                    </label>
                    <input
                      id="reg-fullname"
                      type="text"
                      value={regFullName}
                      onChange={(e) => {
                        setRegFullName(e.target.value);
                        setAuthError('');
                      }}
                      className={styles.input}
                      autoComplete="off"
                      required
                    />
                  </div>

                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel} htmlFor="reg-username">
                      Officer Username *
                    </label>
                    <input
                      id="reg-username"
                      type="text"
                      value={regUsername}
                      onChange={(e) => {
                        setRegUsername(e.target.value);
                        setAuthError('');
                      }}
                      className={styles.input}
                      autoComplete="off"
                      required
                    />
                  </div>
                </div>

                <div className={styles.gridTwoCols}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel} htmlFor="reg-badge">
                      Officer Badge / ID *
                    </label>
                    <input
                      id="reg-badge"
                      type="text"
                      value={regBadgeNumber}
                      onChange={(e) => {
                        setRegBadgeNumber(e.target.value);
                        setAuthError('');
                      }}
                      className={styles.input}
                      autoComplete="off"
                      required
                    />
                  </div>

                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel} htmlFor="reg-email">
                      Official Government Email *
                    </label>
                    <input
                      id="reg-email"
                      type="email"
                      value={regEmail}
                      onChange={(e) => {
                        setRegEmail(e.target.value);
                        setAuthError('');
                      }}
                      className={styles.input}
                      autoComplete="off"
                      required
                    />
                  </div>
                </div>

                <div className={styles.gridTwoCols}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel} htmlFor="reg-branch">
                      Operational Revenue Branch
                    </label>
                    <select
                      id="reg-branch"
                      value={regBranch}
                      onChange={(e) => setRegBranch(e.target.value)}
                      className={styles.selectInput}
                    >
                      <option>Addis Ababa Large Taxpayers Branch</option>
                      <option>Bole Sub-city Revenue Branch</option>
                      <option>Kirkos Sub-city Tax Center</option>
                      <option>Central Tax Enforcement Division</option>
                      <option>Ministry of Revenues Head Office</option>
                      <option>Hawassa Regional Revenue Directorate</option>
                    </select>
                  </div>

                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel} htmlFor="reg-role">
                      Administrative Role
                    </label>
                    <select
                      id="reg-role"
                      value={regRole}
                      onChange={(e) => setRegRole(e.target.value as any)}
                      className={styles.selectInput}
                    >
                      <option value="REVENUE_OFFICER">Revenue Officer (Inspector)</option>
                      <option value="SENIOR_AUDITOR">Senior Tax Auditor</option>
                      <option value="ADMIN">System Administrator</option>
                    </select>
                  </div>
                </div>

                <div className={styles.gridTwoCols}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel} htmlFor="reg-password">
                      Password *
                    </label>
                    <span className={styles.passwordWrapper}>
                      <input
                        id="reg-password"
                        type={showRegPassword ? 'text' : 'password'}
                        value={regPassword}
                        onChange={(e) => {
                          setRegPassword(e.target.value);
                          setAuthError('');
                        }}
                        className={styles.input}
                        placeholder="Min 6 characters"
                        autoComplete="new-password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPassword(!showRegPassword)}
                        aria-label={showRegPassword ? 'Hide password' : 'Show password'}
                        className={styles.eyeButton}
                      >
                        {showRegPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </span>
                  </div>

                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel} htmlFor="reg-confirm">
                      Confirm Password *
                    </label>
                    <input
                      id="reg-confirm"
                      type="password"
                      value={regConfirmPassword}
                      onChange={(e) => {
                        setRegConfirmPassword(e.target.value);
                        setAuthError('');
                      }}
                      className={styles.input}
                      placeholder="Repeat password"
                      autoComplete="new-password"
                      required
                    />
                  </div>
                </div>

                {authError && (
                  <div role="alert" className={styles.errorMessage}>
                    <AlertCircle size={17} style={{ flexShrink: 0 }} />
                    <span>{authError}</span>
                  </div>
                )}

                {regSuccessNotice && !authError && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 14px',
                      backgroundColor: '#F0FDF4',
                      border: '1px solid #BBF7D0',
                      borderRadius: '6px',
                      color: '#15803D',
                      fontSize: '13px',
                      marginBottom: '16px',
                    }}
                  >
                    <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
                    <span>{regSuccessNotice}</span>
                  </div>
                )}

                <div className={styles.certificationBox}>
                  <label className={styles.certLabel}>
                    <input
                      type="checkbox"
                      checked={certifyAuthorized}
                      onChange={(e) => {
                        setCertifyAuthorized(e.target.checked);
                        setAuthError('');
                      }}
                      className={styles.checkbox}
                    />
                    <span>
                      I hereby declare and certify that I am a duly appointed officer of the Ministry of Revenues
                      (MoR) authorized to inspect taxpayer receipts and approve registration filings.
                    </span>
                  </label>
                </div>

                <button type="submit" disabled={isLoading} className={styles.submitBtn}>
                  {isLoading ? 'Registering Officer...' : 'Register Revenue Officer'}
                </button>
              </form>

              <div className={styles.switchPromptBox}>
                <span>Already registered with an officer profile? </span>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('signin');
                    setAuthError('');
                  }}
                  className={styles.switchInlineBtn}
                >
                  Sign in here
                </button>
              </div>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={onReturnToMerchant}
          className={styles.returnBtn}
        >
          Return to Merchant Workspace
        </button>
      </main>

      {/* Right Dark Green Marketing Banner */}
      <aside className={styles.rightBanner}>
        <div className={styles.bannerWrapper}>
          <span className={styles.shieldIcon}>
            <ShieldCheck size={28} />
          </span>
          <h2 className={styles.bannerTitle}>
            {authMode === 'register'
              ? 'Accredited Officer Identity & Verification Workspace'
              : 'A focused workspace for accountable revenue administration.'}
          </h2>
          <p className={styles.bannerDesc}>
            {authMode === 'register'
              ? 'All officer accounts are securely registered and tied to Ministry badge credentials. Audit trails record every clearance, rejection, and tax adjustment.'
              : 'Verify merchant identity, review fiscal records, reconcile tax reports, and record every administrative decision.'}
          </p>

          <div className={styles.featuresList}>
            {[
              'Role-based officer access control',
              'Documented administrative audit logging',
              'Merchant application verification & clearance',
              'Protected MoR administrative audit trail',
            ].map((item) => (
              <p key={item} className={styles.featureItem}>
                <CheckCircle2 size={16} className={styles.checkIcon} />
                <span>{item}</span>
              </p>
            ))}
          </div>

          <div className={styles.bannerNotice}>
            <p className={styles.bannerNoticeTitle}>FEDERAL DEMOCRATIC REPUBLIC OF ETHIOPIA</p>
            <p className={styles.bannerNoticeSub}>Ministry of Revenues · Electronic Fiscal Management System</p>
          </div>
        </div>
      </aside>
    </div>
  );
};

export default OfficerSignIn;
