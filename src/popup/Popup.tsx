import { type FormEvent, useEffect, useState } from 'react';

type AuthUser = { email?: string | null } | null;
type AuthResponse = { ok: true; user?: AuthUser } | { ok: false; error: string };

export function Popup() {
  const [user, setUser] = useState<AuthUser>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    sendMessage<AuthResponse>({ type: 'auth:getUser' })
      .then((response) => {
        if (!cancelled && response.ok) setUser(response.user ?? null);
      })
      .catch(() => {
        if (!cancelled) setMessage('Sign-in state is unavailable.');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function signInWithPassword(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('Signing in...');
    const response = await sendMessage<AuthResponse>({ type: 'auth:signInWithPassword', email, password });
    setBusy(false);
    if (response.ok) {
      setUser(response.user ?? null);
      setMessage('Signed in.');
      return;
    }
    setMessage(response.error);
  }

  async function signInWithGoogle() {
    setBusy(true);
    setMessage('Opening Google sign-in...');
    const response = await sendMessage<AuthResponse>({ type: 'auth:signInWithGoogle' });
    setBusy(false);
    if (response.ok) {
      setUser(response.user ?? null);
      setMessage('Signed in.');
      return;
    }
    setMessage(response.error);
  }

  async function signOut() {
    setBusy(true);
    const response = await sendMessage<AuthResponse>({ type: 'auth:signOut' });
    setBusy(false);
    if (response.ok) {
      setUser(null);
      setMessage('Signed out.');
      return;
    }
    setMessage(response.error);
  }

  return (
    <main className="qbo-popup">
      <h1>Question Bank Overlay</h1>
      {user ? (
        <section className="qbo-popup-section">
          <p>Signed in as {user.email ?? 'this account'}</p>
          <button disabled={busy} onClick={() => void signOut()} type="button">
            Sign out
          </button>
        </section>
      ) : (
        <section className="qbo-popup-section">
          <form onSubmit={(event) => void signInWithPassword(event)}>
            <label>
              Email
              <input
                autoComplete="email"
                onChange={(event) => setEmail(event.currentTarget.value)}
                required
                type="email"
                value={email}
              />
            </label>
            <label>
              Password
              <input
                autoComplete="current-password"
                onChange={(event) => setPassword(event.currentTarget.value)}
                required
                type="password"
                value={password}
              />
            </label>
            <button disabled={busy} type="submit">
              Sign in
            </button>
          </form>
          <button disabled={busy} onClick={() => void signInWithGoogle()} type="button">
            Continue with Google
          </button>
        </section>
      )}
      <p aria-live="polite" className="qbo-popup-message">
        {message}
      </p>
    </main>
  );
}

function sendMessage<T>(message: unknown): Promise<T> {
  return chrome.runtime.sendMessage(message) as Promise<T>;
}
