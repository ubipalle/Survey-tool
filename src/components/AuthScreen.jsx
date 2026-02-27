import React, { useState, useRef, useEffect } from 'react';
import { requestOTP, verifyOTP } from '../utils/surveyApi';

const STEPS = { EMAIL: 'email', OTP: 'otp', VERIFYING: 'verifying' };

export default function AuthScreen({ projectCode, onAuthenticated }) {
  const [step, setStep] = useState(STEPS.EMAIL);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  const otpRefs = useRef([]);

  // Countdown timer for resend
  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  const handleRequestOTP = async (e) => {
    e?.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    setSending(true);
    setError('');

    try {
      await requestOTP(email.trim(), projectCode);
      setStep(STEPS.OTP);
      setResendTimer(60);
      // Focus first OTP input
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (err) {
      setError(err.message);
    }
    setSending(false);
  };

  const handleOTPChange = (index, value) => {
    // Only allow digits
    const digit = value.replace(/\D/g, '').slice(-1);
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);
    setError('');

    // Auto-advance to next input
    if (digit && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits entered
    if (digit && index === 5) {
      const code = newOtp.join('');
      if (code.length === 6) {
        handleVerifyOTP(code);
      }
    }
  };

  const handleOTPKeyDown = (index, e) => {
    // Backspace: clear current and go back
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOTPPaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length > 0) {
      e.preventDefault();
      const newOtp = [...otp];
      for (let i = 0; i < 6; i++) {
        newOtp[i] = pasted[i] || '';
      }
      setOtp(newOtp);
      if (pasted.length === 6) {
        handleVerifyOTP(pasted);
      } else {
        otpRefs.current[pasted.length]?.focus();
      }
    }
  };

  const handleVerifyOTP = async (code) => {
    setStep(STEPS.VERIFYING);
    setError('');

    try {
      const result = await verifyOTP(email.trim(), code, projectCode);
      onAuthenticated({ email: result.email, token: result.token });
    } catch (err) {
      setError(err.message);
      setStep(STEPS.OTP);
      setOtp(['', '', '', '', '', '']);
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    }
  };

  const handleResend = () => {
    if (resendTimer > 0) return;
    setOtp(['', '', '', '', '', '']);
    handleRequestOTP();
  };

  return (
    <div className="screen animate-in" style={{ maxWidth: 400, margin: '0 auto' }}>
      {/* Logo / header */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: 'var(--primary)', color: '#fff',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 16,
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
        </div>
        <h1 className="screen__title" style={{ marginBottom: 4 }}>Site Survey</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Project: <strong>{projectCode}</strong>
        </p>
      </div>

      {/* Email step */}
      {step === STEPS.EMAIL && (
        <div className="card">
          <div className="card__label">Sign in to continue</div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
            Enter the email address you were invited with. We'll send you a one-time access code.
          </p>

          <form onSubmit={handleRequestOTP}>
            <div className="form-group">
              <label className="form-label">Email address</label>
              <input
                type="email"
                className="form-input"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); }}
                autoFocus
                autoComplete="email"
              />
            </div>

            {error && (
              <div style={{
                padding: '10px 14px',
                background: 'var(--danger-bg)',
                border: '1px solid var(--danger)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--danger)',
                fontSize: '0.85rem',
                marginBottom: 16,
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn--primary btn--lg btn--block"
              disabled={sending || !email.trim()}
            >
              {sending ? (
                <>
                  <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                  Sending code...
                </>
              ) : (
                'Send access code'
              )}
            </button>
          </form>
        </div>
      )}

      {/* OTP step */}
      {(step === STEPS.OTP || step === STEPS.VERIFYING) && (
        <div className="card">
          <div className="card__label">Enter access code</div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 20 }}>
            We sent a 6-digit code to <strong>{email}</strong>
          </p>

          {/* OTP inputs */}
          <div style={{
            display: 'flex', gap: 8, justifyContent: 'center',
            marginBottom: 20,
          }}>
            {otp.map((digit, i) => (
              <input
                key={i}
                ref={(el) => otpRefs.current[i] = el}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleOTPChange(i, e.target.value)}
                onKeyDown={(e) => handleOTPKeyDown(i, e)}
                onPaste={i === 0 ? handleOTPPaste : undefined}
                disabled={step === STEPS.VERIFYING}
                style={{
                  width: 44, height: 52,
                  textAlign: 'center',
                  fontSize: '1.3rem',
                  fontWeight: 700,
                  borderRadius: 'var(--radius-md)',
                  border: '2px solid var(--border)',
                  background: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  transition: 'border-color 0.15s',
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
              />
            ))}
          </div>

          {step === STEPS.VERIFYING && (
            <div style={{ textAlign: 'center', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Verifying...</span>
            </div>
          )}

          {error && (
            <div style={{
              padding: '10px 14px',
              background: 'var(--danger-bg)',
              border: '1px solid var(--danger)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--danger)',
              fontSize: '0.85rem',
              marginBottom: 16,
            }}>
              {error}
            </div>
          )}

          {/* Resend */}
          <div style={{ textAlign: 'center' }}>
            {resendTimer > 0 ? (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Resend code in {resendTimer}s
              </span>
            ) : (
              <button
                className="btn btn--sm btn--secondary"
                onClick={handleResend}
                disabled={sending}
              >
                Resend code
              </button>
            )}
          </div>

          {/* Change email */}
          <div style={{ textAlign: 'center', marginTop: 12 }}>
            <button
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '0.8rem', color: 'var(--primary)',
                textDecoration: 'underline',
              }}
              onClick={() => {
                setStep(STEPS.EMAIL);
                setOtp(['', '', '', '', '', '']);
                setError('');
              }}
            >
              Use a different email
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
