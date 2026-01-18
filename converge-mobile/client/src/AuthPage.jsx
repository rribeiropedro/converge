import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, signup } from './authUtils';
import './AuthPage.css';

function AuthPage({ onAuthSuccess }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState('login'); // 'login' or 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const validateForm = () => {
    if (!email) {
      setError('Email is required');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email');
      return false;
    }
    if (!password) {
      setError('Password is required');
      return false;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) return;

    setIsLoading(true);

    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await signup(email, password);
      }
      onAuthSuccess();
      navigate('/record');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      {/* Header - Notion style */}
      <header className="auth-header-top">
        <div className="auth-header-logo">
          <div className="logo-icon">N</div>
          <span className="auth-header-title">Converge</span>
        </div>
      </header>

      {/* Auth Card - Notion style centered */}
      <main className="auth-main">
        <div className="auth-card">
          <div className="auth-card-inner">
            {/* Tabs - Notion style segmented control */}
            <div className="auth-tabs">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError('');
                }}
                className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
              >
                Log in
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setError('');
                }}
                className={`auth-tab ${mode === 'signup' ? 'active' : ''}`}
              >
                Sign up
              </button>
            </div>

            {/* Title */}
            <div className="auth-title">
              <h1>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
              <p className="auth-subtitle">
                {mode === 'login'
                  ? 'Enter your credentials to access your network'
                  : 'Start building your AI-powered network memory'}
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="auth-form">
              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError('');
                  }}
                  className={error && !email ? 'error' : ''}
                  disabled={isLoading}
                />
                {error && !email && (
                  <p>{error}</p>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  className={error && password.length < 6 ? 'error' : ''}
                  disabled={isLoading}
                />
                {error && password.length < 6 && (
                  <p>{error}</p>
                )}
              </div>

              {error && email && password.length >= 6 && (
                <div className="error-message">
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="btn-submit"
                disabled={isLoading}
              >
                {isLoading
                  ? 'Please wait...'
                  : mode === 'login'
                  ? 'Log in'
                  : 'Create account'}
              </button>
            </form>

            {/* Footer text */}
            <p className="auth-footer">
              {mode === 'login' ? (
                <>
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signup');
                      setError('');
                    }}
                    className="link-button"
                  >
                    Sign up
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setError('');
                    }}
                    className="link-button"
                  >
                    Log in
                  </button>
                </>
              )}
            </p>

            {/* Hackathon: Skip to recording */}
            <button
              type="button"
              onClick={() => {
                onAuthSuccess();
                navigate('/record');
              }}
              className="skip-button"
            >
              Skip to Recording (Demo Mode)
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default AuthPage;

