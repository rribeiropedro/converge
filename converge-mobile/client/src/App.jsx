import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import CameraRecorder from './CameraRecorder';
import AuthPage from './AuthPage';
import { isAuthenticated, logoutFromAPI } from './authUtils';

function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is authenticated on mount
    const checkAuth = () => {
      const isAuth = isAuthenticated();
      setAuthenticated(isAuth);
      setLoading(false);
    };

    checkAuth();
  }, []);

  const handleAuthSuccess = () => {
    setAuthenticated(true);
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#191919',
        color: 'rgba(255, 255, 255, 0.9)',
        fontSize: '1.2rem',
        fontWeight: '500'
      }}>
        Loading...
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route 
          path="/" 
          element={
            authenticated ? (
              <Navigate to="/record" replace />
            ) : (
              <AuthPage onAuthSuccess={handleAuthSuccess} />
            )
          } 
        />
        <Route 
          path="/record" 
          element={
            authenticated ? (
              <CameraRecorder />
            ) : (
              <Navigate to="/" replace />
            )
          } 
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

