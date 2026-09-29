/** Registration screen (REQ-1 to REQ-4). */
import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ErrorMessage } from '../components/ui';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: '',
    password: '',
    displayName: '',
    telegramUsername: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function update(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await register(form);
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
        <h2 className="mb-5">Create an account</h2>
        <ErrorMessage message={error} />

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* REQ-2: only NTU student addresses are accepted. */}
          <div>
            <label className="label">NTU email</label>
            <input
              type="email"
              className="input"
              required
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              placeholder="yourname@e.ntu.edu.sg"
            />
            <p className="t-caption mt-2 px-0.5">Must end in @e.ntu.edu.sg</p>
          </div>

          <div>
            <label className="label">Password</label>
            <input
              type="password"
              className="input"
              required
              minLength={8}
              value={form.password}
              onChange={(e) => update('password', e.target.value)}
            />
            <p className="t-caption mt-2 px-0.5">At least 8 characters.</p>
          </div>

          {/* REQ-3: display name and Telegram username are required. */}
          <div>
            <label className="label">Display name</label>
            <input
              className="input"
              required
              value={form.displayName}
              onChange={(e) => update('displayName', e.target.value)}
            />
          </div>

          <div>
            <label className="label">Telegram username</label>
            <input
              className="input"
              required
              value={form.telegramUsername}
              onChange={(e) => update('telegramUsername', e.target.value)}
              placeholder="@yourhandle"
            />
            <p className="t-caption mt-2 px-0.5">
              Only shared once an ownership claim is approved.
            </p>
          </div>

          <button className="btn-primary w-full" disabled={busy}>
            {busy ? 'Creating account...' : 'Register'}
          </button>
        </form>
      </div>

      <p className="t-sub mt-6 text-center">
        Already registered?{' '}
        <Link to="/login" className="font-medium" style={{ color: 'var(--blue)' }}>
          Log in
        </Link>
      </p>
    </div>
  );
}
