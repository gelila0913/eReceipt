import React, { useState, useEffect } from 'react';
import { Mail, CheckCircle2, AlertCircle, RotateCw, X, Zap } from 'lucide-react';
import { API_BASE_URL } from '../../../config/api';

interface MerchantEmailOtpModalProps {
  email: string;
  recipientName: string;
  isOpen: boolean;
  onClose: () => void;
  onVerified: () => void;
}

export const MerchantEmailOtpModal: React.FC<MerchantEmailOtpModalProps> = ({
  email,
  recipientName,
  isOpen,
  onClose,
  onVerified,
}) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(45);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [simulatedCode, setSimulatedCode] = useState<string | null>(null);
  const [isSimulated, setIsSimulated] = useState<boolean>(false);
  const [deliveryNotice, setDeliveryNotice] = useState<string | null>(null);

  // Send OTP on initial modal open
  useEffect(() => {
    if (!isOpen) return;
    setCode('');
    setError(null);
    setSuccessNotice(null);
    setSimulatedCode(null);
    setIsSimulated(false);
    setDeliveryNotice(null);
    sendOtpCode();
  }, [isOpen, email]);

  // Countdown timer for resend
  useEffect(() => {
    if (!isOpen || resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen, resendCooldown]);

  const [offlineFallbackCode, setOfflineFallbackCode] = useState<string | null>(null);

  // Helper to dispatch OTP requests with proxy fallback
  const postOtpRequest = async (endpoint: string, bodyPayload: any) => {
    const primaryUrl = `${API_BASE_URL}${endpoint}`;
    try {
      const res = await fetch(primaryUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || data.error || `HTTP ${res.status}: Failed to reach verification service.`);
      }
      return data;
    } catch (primaryErr: any) {
      // If primary absolute URL failed with network error, attempt relative path (Vite dev proxy)
      if (primaryUrl.startsWith('http')) {
        try {
          const fallbackRes = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bodyPayload),
          });
          const fallbackData = await fallbackRes.json().catch(() => ({}));
          if (!fallbackRes.ok) {
            throw new Error(fallbackData.message || fallbackData.error || `HTTP ${fallbackRes.status}`);
          }
          return fallbackData;
        } catch {
          // Fall through to primary error
        }
      }
      throw primaryErr;
    }
  };

  const sendOtpCode = async () => {
    try {
      setIsResending(true);
      setError(null);

      const data = await postOtpRequest('/api/otp/send', {
        email: email.trim(),
        purpose: 'merchant_registration',
        recipientName: recipientName.trim(),
      });

      if (!data.success) {
        throw new Error(data.message || data.error || 'Failed to dispatch verification code.');
      }

      setResendCooldown(data.cooldownSeconds || 45);
      setIsSimulated(Boolean(data.simulated));
      setDeliveryNotice(data.deliveryNotice || null);
      if (data.code) {
        setSimulatedCode(data.code);
      }
      setSuccessNotice(data.message || `Verification code sent to ${email}.`);
    } catch (err: any) {
      const isNetwork =
        err?.name === 'TypeError' ||
        (err?.message && (err.message.includes('fetch') || err.message.includes('NetworkError')));

      if (isNetwork) {
        // Backend offline / unreachable: activate client-side simulation code
        const fallback = '123456';
        setOfflineFallbackCode(fallback);
        setSimulatedCode(fallback);
        setIsSimulated(true);
        setDeliveryNotice(
          'Backend is currently offline or unreachable. Running in offline development mode: use code 123456 to continue.'
        );
        setSuccessNotice('Offline demo mode active (Backend is not reachable).');
      } else {
        setError(err.message || 'Could not send verification email. Please check the address.');
      }
    } finally {
      setIsResending(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || isResending) return;
    await sendOtpCode();
  };

  const inputRef = React.useRef<HTMLInputElement>(null);

  // Close modal on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const verifyCode = async (codeToVerify: string) => {
    const cleanCode = codeToVerify.trim();
    if (cleanCode.length !== 6) {
      setError('Please enter the complete 6-digit verification code.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const data = await postOtpRequest('/api/otp/verify', {
        email: email.trim(),
        code: cleanCode,
        purpose: 'merchant_registration',
      });

      if (!data.success) {
        throw new Error(data.message || data.error || 'Invalid or expired verification code.');
      }

      onVerified();
    } catch (err: any) {
      const isNetwork =
        err?.name === 'TypeError' ||
        (err?.message && (err.message.includes('fetch') || err.message.includes('NetworkError')));

      // In offline mode, if code matches simulated code or fallback, allow completion
      if (isNetwork && (cleanCode === simulatedCode || cleanCode === offlineFallbackCode || cleanCode === '123456')) {
        onVerified();
      } else {
        setError(err.message || 'Verification failed. Please check the code.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    await verifyCode(code);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text');
    const digits = pasted.replace(/\D/g, '').slice(0, 6);
    if (digits.length > 0) {
      e.preventDefault();
      setCode(digits);
      setError(null);
      if (digits.length === 6) {
        verifyCode(digits);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.2s ease-out',
      }}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '14px',
          width: '100%',
          maxWidth: '460px',
          padding: '28px 24px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          position: 'relative',
        }}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute',
            top: '18px',
            right: '18px',
            background: 'none',
            border: 'none',
            color: '#94A3B8',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '6px',
          }}
        >
          <X size={20} />
        </button>

        {/* Header Icon */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              backgroundColor: '#ECFDF5',
              border: '1px solid #A7F3D0',
              color: '#059669',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Mail size={22} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0F172A' }}>
              Verify Business Email
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#64748B' }}>
              {isSimulated ? 'Simulation Active · Instant Code Available' : '6-Digit Email Verification'}
            </p>
          </div>
        </div>

        <p style={{ fontSize: '14px', color: '#334155', lineHeight: 1.5, margin: '0 0 16px 0' }}>
          We sent a 6-digit confirmation code to:
          <br />
          <strong style={{ color: '#0F172A', fontWeight: 600 }}>{email}</strong>
        </p>

        {/* Simulation / Development Banner */}
        {simulatedCode && (
          <div
            style={{
              backgroundColor: '#FEF3C7',
              border: '1px solid #FCD34D',
              borderRadius: '8px',
              padding: '12px 14px',
              marginBottom: '16px',
              color: '#92400E',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '6px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '13px' }}>
                <Zap size={15} color="#D97706" />
                <span>Simulation / Dev Mode</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCode(simulatedCode);
                  setError(null);
                  verifyCode(simulatedCode);
                }}
                style={{
                  backgroundColor: '#D97706',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background-color 0.15s',
                }}
              >
                Autofill & Verify
              </button>
            </div>
            <p style={{ margin: '0 0 4px 0', fontSize: '12px', lineHeight: 1.4, color: '#78350F' }}>
              Email delivery is simulated. Your verification code is:
              <strong
                style={{
                  marginLeft: '6px',
                  fontSize: '15px',
                  letterSpacing: '2px',
                  fontFamily: 'monospace',
                  color: '#92400E',
                  backgroundColor: '#FDE68A',
                  padding: '2px 6px',
                  borderRadius: '4px',
                }}
              >
                {simulatedCode}
              </strong>
            </p>
            {deliveryNotice && (
              <p style={{ margin: 0, fontSize: '11px', color: '#B45309', opacity: 0.9 }}>
                {deliveryNotice}
              </p>
            )}
          </div>
        )}

        <form onSubmit={handleVerify}>
          {/* OTP Input Field */}
          <div style={{ marginBottom: '16px' }}>
            <label
              htmlFor="merchant-otp-input"
              style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}
            >
              Enter 6-digit code
            </label>
            <input
              id="merchant-otp-input"
              ref={inputRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              autoFocus
              value={code}
              onPaste={handlePaste}
              onChange={(e) => {
                const clean = e.target.value.replace(/\D/g, '').slice(0, 6);
                setCode(clean);
                setError(null);
                if (clean.length === 6) {
                  verifyCode(clean);
                }
              }}
              placeholder="••••••"
              style={{
                width: '100%',
                padding: '12px 16px',
                fontSize: '26px',
                fontWeight: 800,
                letterSpacing: '10px',
                textAlign: 'center',
                fontFamily: 'monospace',
                borderRadius: '8px',
                border: error ? '1.5px solid #EF4444' : '1.5px solid #CBD5E1',
                outline: 'none',
                boxSizing: 'border-box',
                backgroundColor: '#F8FAFC',
              }}
            />
          </div>

          {/* Error Message */}
          {error && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 12px',
                backgroundColor: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: '6px',
                color: '#DC2626',
                fontSize: '13px',
                marginBottom: '16px',
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {/* Success Notice */}
          {successNotice && !error && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                backgroundColor: '#F0FDF4',
                border: '1px solid #BBF7D0',
                borderRadius: '6px',
                color: '#15803D',
                fontSize: '12px',
                marginBottom: '16px',
              }}
            >
              <CheckCircle2 size={15} style={{ flexShrink: 0 }} />
              <span>{successNotice}</span>
            </div>
          )}

          {/* Resend Action with Countdown */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '20px',
              fontSize: '13px',
            }}
          >
            <span style={{ color: '#64748B' }}>Didn't receive code?</span>
            {resendCooldown > 0 ? (
              <span style={{ color: '#94A3B8', fontWeight: 500 }}>
                Resend in {resendCooldown}s
              </span>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                disabled={isResending}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#176B4D',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: 0,
                }}
              >
                <RotateCw size={13} className={isResending ? 'spin' : ''} />
                {isResending ? 'Sending...' : 'Resend code'}
              </button>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                backgroundColor: '#FFFFFF',
                color: '#475569',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Change Email
            </button>
            <button
              type="submit"
              disabled={isSubmitting || code.length !== 6}
              style={{
                flex: 1.5,
                padding: '12px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: code.length === 6 && !isSubmitting ? '#176B4D' : '#94A3B8',
                color: '#FFFFFF',
                fontSize: '14px',
                fontWeight: 600,
                cursor: code.length === 6 && !isSubmitting ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              {isSubmitting ? 'Verifying...' : 'Verify & Continue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MerchantEmailOtpModal;
