import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getApiError } from '../services/api';
import { authService } from '../services/auth.service';
import { disconnectSocket } from '../services/socket';

const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); const [loading, setLoading] = useState(authService.hasSession());
  const logout = useCallback(() => { authService.logout(); disconnectSocket(); setUser(null); }, []);
  useEffect(() => { const expired = () => logout(); window.addEventListener('auth:expired', expired); if (authService.hasSession()) authService.me().then(setUser).catch(logout).finally(() => setLoading(false)); return () => window.removeEventListener('auth:expired', expired); }, [logout]);
  const login = useCallback(async credentials => { try { const result = await authService.login(credentials); setUser(result.user); return { ok: true, user: result.user }; } catch (error) { return { ok: false, message: getApiError(error) }; } }, []);
  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
