// Authentication utilities for mobile app

// Get API URL dynamically based on current hostname
// This allows the app to work when accessed from mobile devices via LAN IP
const getApiUrl = () => {
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  // Use the same hostname the browser is on, but port 3001
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  return `${protocol}//${hostname}:3001`;
};

const API_URL = getApiUrl();

// Get the stored token
export const getToken = () => {
  return localStorage.getItem('token');
};

// Get the stored user
export const getUser = () => {
  const userStr = localStorage.getItem('user');
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
};

// Check if user is authenticated
export const isAuthenticated = () => {
  return !!getToken();
};

// Clear auth data (logout)
export const logout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};

// Store auth data
export const setAuthData = (token, user) => {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
};

// Login user
export const login = async (email, password) => {
  const response = await fetch(`${API_URL}/api/users/login`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Login failed');
  }

  const data = await response.json();
  setAuthData(data.token, data.user);
  return data;
};

// Signup user
export const signup = async (email, password) => {
  const response = await fetch(`${API_URL}/api/users`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Signup failed');
  }

  const data = await response.json();
  setAuthData(data.token, data.user);
  return data;
};

// Logout from API
export const logoutFromAPI = async () => {
  try {
    await fetch(`${API_URL}/api/users/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    logout();
  }
};

