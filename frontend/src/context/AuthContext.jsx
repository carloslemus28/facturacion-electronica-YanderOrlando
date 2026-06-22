import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';

import {
  loginRequest,
  logoutRequest,
  refreshRequest,
  meRequest
} from '../api/auth.api';

import { tokenStore } from '../api/tokenStore';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessTokenState] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const authVersionRef = useRef(0);

  const isAuthenticated = Boolean(user && accessToken);

  const setAccessToken = (token) => {
    setAccessTokenState(token);
    tokenStore.setAccessToken(token);
  };

  const clearSession = () => {
  setUser(null);
  setAccessTokenState(null);
  tokenStore.clearAccessToken();
};

  const login = async ({ username, password }) => {
    authVersionRef.current += 1;

    const data = await loginRequest({ username, password });

    setUser(data.user);
    setAccessToken(data.accessToken);
    setLoadingAuth(false);

    toast.success('Inicio de sesión correcto');

    return data;
  };

  const logout = async () => {
    try {
      await logoutRequest();
    } catch (error) {
      console.error('Error cerrando sesión:', error);
    } finally {
      clearSession();
      toast.success('Sesión cerrada correctamente');
    }
  };

  const refreshSession = async () => {
    try {
      const data = await refreshRequest();

      setUser(data.user);
      setAccessToken(data.accessToken);

      return data.accessToken;
    } catch (error) {
      clearSession();
      return null;
    }
  };

  const validateSession = async () => {
    const validationVersion = authVersionRef.current;

    try {
      const data = await refreshRequest();

      if (validationVersion !== authVersionRef.current) {
        return;
      }

      setUser(data.user);
      setAccessToken(data.accessToken);

      await meRequest();
    } catch (error) {
      if (validationVersion !== authVersionRef.current) {
        return;
      }

      clearSession();
    } finally {
      if (validationVersion === authVersionRef.current) {
        setLoadingAuth(false);
      }
    }
  };

  useEffect(() => {
    validateSession();
  }, []);

  useEffect(() => {
    const handleSessionExpired = () => {
      clearSession();
      toast.error('Su sesión expiró. Inicie sesión nuevamente.');
    };

    window.addEventListener('auth:session-expired', handleSessionExpired);

    return () => {
      window.removeEventListener('auth:session-expired', handleSessionExpired);
    };
  }, []);

  const value = useMemo(() => ({
    user,
    accessToken,
    loadingAuth,
    isAuthenticated,
    login,
    logout,
    refreshSession
  }), [user, accessToken, loadingAuth, isAuthenticated]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }

  return context;
}