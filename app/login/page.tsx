'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-auth'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)
  const router  = useRouter()
  const supabase = createClient()

  async function handleLogin() {
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/')
      router.refresh()
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'DM Sans', sans-serif; }

        .login-page {
          min-height: 100vh;
          display: flex;
        }

        /* Left panel — blue brand */
        .left-panel {
          width: 45%;
          background: linear-gradient(180deg, #2176d9, #1148a8);
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: flex-start;
          padding: 64px;
          position: relative;
          overflow: hidden;
        }
        .left-panel::before {
          content: '';
          position: absolute;
          top: -100px; right: -100px;
          width: 400px; height: 400px;
          border-radius: 50%;
          background: radial-gradient(circle, #3a8ef0 0%, transparent 70%);
          opacity: 0.4;
        }
        .left-panel::after {
          content: '';
          position: absolute;
          bottom: -80px; left: -80px;
          width: 300px; height: 300px;
          border-radius: 50%;
          background: radial-gradient(circle, #5a9ef0 0%, transparent 70%);
          opacity: 0.3;
        }
        .brand {
          font-family: 'DM Serif Display', serif;
          font-size: 42px;
          color: #fff;
          margin-bottom: 16px;
          position: relative; z-index: 1;
        }
        .brand span { color: #a0c4f0; }
        .brand-tagline {
          font-size: 16px;
          color: #8ab8e8;
          line-height: 1.6;
          max-width: 320px;
          position: relative; z-index: 1;
        }
        .brand-features {
          margin-top: 48px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          position: relative; z-index: 1;
        }
        .brand-feature {
          display: flex;
          align-items: center;
          gap: 12px;
          color: #a0c4f0;
          font-size: 14px;
        }
        .feature-dot {
          width: 8px; height: 8px;
          border-radius: 50%;
          background: #a0c4f0;
          flex-shrink: 0;
        }

        /* Right panel — login form */
        .right-panel {
          flex: 1;
          background: #f4f1eb;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          padding: 64px;
        }
        .login-card {
          width: 100%;
          max-width: 400px;
        }
        .login-title {
          font-family: 'DM Serif Display', serif;
          font-size: 28px;
          color: #1a3a6a;
          margin-bottom: 8px;
        }
        .login-subtitle {
          font-size: 14px;
          color: #7a8fa0;
          margin-bottom: 36px;
        }
        .field {
          margin-bottom: 20px;
        }
        .field label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          color: #4a6a8a;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          margin-bottom: 8px;
        }
        .field input {
          width: 100%;
          padding: 12px 16px;
          border-radius: 10px;
          border: 1.5px solid #e0ddd6;
          background: #fff;
          font-family: 'DM Sans', sans-serif;
          font-size: 15px;
          color: #1a2a3a;
          outline: none;
          transition: border-color 0.15s;
        }
        .field input:focus {
          border-color: #2176d9;
        }
        .error-msg {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #dc2626;
          padding: 10px 14px;
          border-radius: 8px;
          font-size: 13px;
          margin-bottom: 20px;
        }
        .login-btn {
          width: 100%;
          padding: 14px;
          border-radius: 10px;
          border: none;
          background: #1a4ba0;
          color: #fff;
          font-family: 'DM Sans', sans-serif;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s;
          margin-top: 4px;
        }
        .login-btn:hover:not(:disabled) { background: #1a5fb8; }
        .login-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        .login-footer {
          margin-top: 24px;
          font-size: 12px;
          color: #7a8fa0;
          text-align: center;
        }

        @media (max-width: 768px) {
          .left-panel { display: none; }
          .right-panel { padding: 32px 24px; }
        }
      `}</style>

      <div className="login-page">
        {/* Left — brand panel */}
        <div className="left-panel">
          <div className="brand"><span>all</span>Farm</div>
          <div className="brand-tagline">
            Precision farm management for South African fruit farms.
          </div>
          <div className="brand-features">
            <div className="brand-feature">
              <div className="feature-dot" />
              Live orchard pressure maps
            </div>
            <div className="brand-feature">
              <div className="feature-dot" />
              Pest trend analysis by season
            </div>
            <div className="brand-feature">
              <div className="feature-dot" />
              Trap count monitoring with thresholds
            </div>
            <div className="brand-feature">
              <div className="feature-dot" />
              Multi-farm & multi-role access
            </div>
          </div>
        </div>

        {/* Right — login form */}
        <div className="right-panel">
          <div className="login-card">
            <div className="login-title">Welcome back</div>
            <div className="login-subtitle">Sign in to your allFarm account</div>

            {error && <div className="error-msg">{error}</div>}

            <div className="field">
              <label>Email address</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                autoFocus
              />
            </div>

            <div className="field">
              <label>Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
              />
            </div>

            <button
              className="login-btn"
              onClick={handleLogin}
              disabled={loading || !email || !password}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>

            <div className="login-footer">
              Need access? Contact your farm administrator.
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
