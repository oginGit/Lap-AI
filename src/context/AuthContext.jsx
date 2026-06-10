/**
 * AuthContext.jsx — Authentication State Manager
 * Provides auth state (user, token, loading) to the entire app.
 * Persists JWT in localStorage and auto-verifies on mount.
 * Uses Vite proxy — all requests go through /api/auth (no hardcoded port).
 */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

// Use relative path — Vite proxy handles routing to the auth backend
const AUTH_API = '/api/auth';

/**
 * Safely parse JSON from a fetch Response.
 * Returns null if the body is empty or not valid JSON.
 * This prevents "Unexpected end of JSON input" when the server is unreachable
 * or returns an empty/non-JSON response.
 */
async function safeJson(res) {
  const text = await res.text();
  if (!text || text.trim() === '') return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('laptopmd_token'));
  const [loading, setLoading] = useState(true);

  // Verify existing token on mount
  useEffect(() => {
    async function verifyToken() {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`${AUTH_API}/verify-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setUser(data.user);
          } else {
            logout();
          }
        } else {
          logout();
        }
      } catch {
        // Auth server might be down — try to decode token locally
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          if (payload.exp * 1000 > Date.now()) {
            setUser({ id: payload.id, email: payload.email, name: payload.name });
          } else {
            logout();
          }
        } catch {
          logout();
        }
      } finally {
        setLoading(false);
      }
    }

    verifyToken();
  }, []);

  const login = useCallback(async (email, password) => {
    let res;
    try {
      res = await fetch(`${AUTH_API}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
    } catch {
      throw new Error('Cannot connect to auth server. Make sure the backend is running (port 5051).');
    }

    const data = await safeJson(res);

    if (!data) {
      if (!res.ok) {
        throw new Error(`Auth Server Error (${res.status}): ${res.statusText}`);
      }
      throw new Error('Server returned an empty response. The auth backend may have crashed.');
    }

    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Login failed');
    }

    localStorage.setItem('laptopmd_token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data;
  }, []);

  const signup = useCallback(async (name, email, password, confirmPassword) => {
    let res;
    try {
      res = await fetch(`${AUTH_API}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, confirmPassword }),
      });
    } catch {
      throw new Error('Cannot connect to auth server. Make sure the backend is running (port 5051).');
    }

    const data = await safeJson(res);

    if (!data) {
      if (!res.ok) {
        throw new Error(`Auth Server Error (${res.status}): ${res.statusText}`);
      }
      throw new Error('Server returned an empty response. The auth backend may have crashed.');
    }

    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Signup failed');
    }

    // Don't auto-login — return data so UI can redirect to login page
    return data;
  }, []);

  const googleLogin = useCallback(async (googleData) => {
    // Simulated Google Login
    setLoading(true);
    try {
      // In a real app, you'd send googleData.tokenId to your backend
      // and verify it there. For now, we simulate a successful login.
      console.log('Simulating Google Login with data:', googleData);
      
      // Artificial delay to feel real
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const mockUser = {
        id: 'google_' + Math.random().toString(36).substr(2, 9),
        name: googleData.name || 'Google User',
        email: googleData.email || 'user@google.com',
        avatar: googleData.picture
      };
      
      const mockToken = 'mock_google_jwt_' + Math.random().toString(36).substr(2);
      
      localStorage.setItem('laptopmd_token', mockToken);
      setToken(mockToken);
      setUser(mockUser);
      return { success: true, user: mockUser };
    } catch (err) {
      throw new Error('Google Sign-In failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('laptopmd_token');
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, signup, googleLogin, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
