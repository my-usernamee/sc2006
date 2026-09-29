/** Account management (REQ-7). */
import { FormEvent, useState } from 'react';
import { authApi } from '../api';
import { useAuth } from '../auth/AuthContext';
import { ErrorMessage, PageTitle, SuccessMessage } from '../components/ui';

export function AccountPage() {
  const { user, setUser } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [telegramUsername, setTelegramUsername] = useState(user?.telegramUsername ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(null);
    setBusy(true);
    try {
      const updated = await authApi.updateAccount({ displayName, telegramUsername });
      setUser(updated);
      setSaved('Your details have been saved.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageTitle>My account</PageTitle>
      <ErrorMessage message={error} />
      <SuccessMessage message={saved} />

      <div className="card p-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* The email address identifies the account and cannot be changed. */}
          <div>
            <label className="label">NTU email</label>
            <input className="input bg-[var(--fill)]" value={user?.email ?? ''} disabled />
          </div>

          <div>
            <label className="label">Display name</label>
            <input
              className="input"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>

          <div>
            <label className="label">Telegram username</label>
            <input
              className="input"
              required
              value={telegramUsername}
              onChange={(e) => setTelegramUsername(e.target.value)}
            />
          </div>

          <button className="btn-primary w-full" disabled={busy}>
            {busy ? 'Saving...' : 'Save changes'}
          </button>
        </form>
      </div>
    </div>
  );
}
