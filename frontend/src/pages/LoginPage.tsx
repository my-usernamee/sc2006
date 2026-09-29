/** Login screen (REQ-5, REQ-6). */
import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ErrorMessage } from '../components/ui';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
      navigate('/browse');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-12">
      <div className="rise mb-9 text-center">
        <h1 className="text-[34px] leading-none tracking-[-0.025em]">FoundIt</h1>
        <p className="t-sub mt-2">NTU Lost and Found</p>
      </div>

      <div className="rise card p-5">
        <h2 className="mb-5">Log in</h2>
        <ErrorMessage message={error} />

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="label">NTU email</label>
            <input
              type="email"
              className="input"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="yourname@e.ntu.edu.sg"
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              type="password"
              className="input"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? 'Logging in...' : 'Log in'}
          </button>
        </form>
      </div>

      <p className="t-sub mt-6 text-center">
        No account?{' '}
        <Link to="/register" className="font-medium" style={{ color: 'var(--blue)' }}>
          Register
        </Link>
      </p>
    </div>
  );
}
