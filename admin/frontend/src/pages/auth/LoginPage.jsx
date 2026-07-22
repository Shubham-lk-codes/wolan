import { useState } from 'react';
import { useAuth } from '../../state/AuthContext';
import { useRouter } from '../../router/Router';
import { dashboardPathFor } from '../../config/roles';

const GoogleIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.91h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.4Z"/><path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.43l-3.24-2.54c-.9.6-2.05.97-3.38.97-2.6 0-4.81-1.76-5.6-4.13H3.06v2.62A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.4 13.87A6.02 6.02 0 0 1 6.08 12c0-.65.11-1.28.32-1.87V7.51H3.06A10 10 0 0 0 2 12c0 1.61.39 3.14 1.06 4.49l3.34-2.62Z"/><path fill="#EA4335" d="M12 6c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.63 9.63 0 0 0 12 2a10 10 0 0 0-8.94 5.51l3.34 2.62C7.19 7.76 9.4 6 12 6Z"/></svg>;
const AppleIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17.05 12.54c-.03-3.1 2.53-4.6 2.65-4.67a5.7 5.7 0 0 0-4.48-2.43c-1.88-.2-3.7 1.13-4.66 1.13-.97 0-2.44-1.11-4.02-1.08a5.93 5.93 0 0 0-5 3.05c-2.17 3.76-.55 9.28 1.53 12.32 1.04 1.49 2.25 3.14 3.83 3.08 1.55-.06 2.13-.99 4-.99 1.85 0 2.4.99 4.02.95 1.66-.02 2.7-1.49 3.7-2.99a12.3 12.3 0 0 0 1.7-3.45 5.35 5.35 0 0 1-3.27-4.92ZM14 3.45A5.4 5.4 0 0 0 15.23-.43a5.5 5.5 0 0 0-3.58 1.85 5.16 5.16 0 0 0-1.27 3.73A4.56 4.56 0 0 0 14 3.45Z"/></svg>;

export function LoginPage() {
  const { login } = useAuth();
  const { navigate } = useRouter();
  const [email, setEmail] = useState('admin@wolan.com');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    const result = await login({ email, password });
    if (!result.ok) setError(result.message);
    else navigate(dashboardPathFor(result.user));
    setSubmitting(false);
  }

  return <main className="login-page">
    <section className="login-intro" aria-label="Wolan Delivery admin access">
      <header>
        <div className="login-logo"><strong>W</strong><small>WOLAN<br/>DELIVERY</small></div>
        <div><span>WOLAN DELIVERY</span><h1>Admin access</h1></div>
      </header>
      <p>Monitor operations, hubs, riders, and dispatch workflows.</p>
      <div className="login-features">
        <div><span>ADMIN WORKSPACE</span><strong>Operations control</strong></div>
        <div><span>SECURE ACCESS</span><strong>Staff sign-in</strong></div>
        <div><span>LIVE MODULES</span><strong>Orders and riders</strong></div>
      </div>
    </section>

    <form className="login-card" onSubmit={submit}>
      <header className="login-heading">
        <div><span>AUTHENTICATION</span><h2>Choose how to continue</h2></div>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 5 6v5c0 4.6 2.9 8.8 7 10 4.1-1.2 7-5.4 7-10V6l-7-3Z"/><path d="m9.5 12 1.6 1.6 3.5-3.7"/></svg>
      </header>
      <button className="oauth-button" type="button"><GoogleIcon/><strong>Sign in with Google</strong><span>GMAIL</span></button>
      <button className="oauth-button" type="button"><AppleIcon/><strong>Sign in with Apple</strong><span>ICLOUD</span></button>
      <div className="login-method"><strong>Password</strong><span>Email access</span></div>
      <p className="login-note">Use password login for active operational access. OAuth buttons require production provider URLs before redirect.</p>
      {error && <div className="warning-note">{error}</div>}
      <label>Email<input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} required/></label>
      <label>Password<div className="password-input"><input type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Password" value={password} onChange={event => setPassword(event.target.value)} required/><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(value => !value)}><svg viewBox="0 0 24 24"><path d="M2.5 12s3.5-5 9.5-5 9.5 5 9.5 5-3.5 5-9.5 5-9.5-5-9.5-5Z"/><circle cx="12" cy="12" r="2.5"/></svg></button></div></label>
      <button className="login-submit" disabled={submitting}>{submitting ? 'Signing in...' : 'Sign in'}</button>
      <button className="forgot-button" type="button">Forgot password? Send reset email</button>
    </form>
  </main>;
}
