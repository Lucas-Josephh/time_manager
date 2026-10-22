'use client';

import { useSyncExternalStore, useState, type FormEvent } from 'react';
import { authClient } from '@/lib/auth-client';
import './page.scss';

function subscribeToLocation(onChange: () => void) {
  window.addEventListener('popstate', onChange);
  return () => window.removeEventListener('popstate', onChange);
}

export default function Home() {
  const {
    data: session,
    isPending: loading,
    error: sessionError,
  } = authClient.useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [callbackErrorDismissed, setCallbackErrorDismissed] = useState(false);
  const search = useSyncExternalStore(
    subscribeToLocation,
    () => window.location.search,
    () => '',
  );
  const callbackError =
    !callbackErrorDismissed && new URLSearchParams(search).has('error')
      ? 'Connexion Microsoft refusée. Vérifie que ton compte appartient à notre organisation et que ton adresse email a été ajoutée dans Time Manager.'
      : '';

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    setCallbackErrorDismissed(true);
    try {
      await action();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Une erreur est survenue.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function microsoft() {
    await run(async () => {
      const { error } = await authClient.signIn.social({
        provider: 'microsoft',
        callbackURL: window.location.origin,
        errorCallbackURL: `${window.location.origin}/?error=microsoft`,
      });
      if (error)
        throw new Error(error.message || 'La connexion Microsoft a échoué.');
    });
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    await run(async () => {
      const { error } = await authClient.signIn.email({
        email: String(fields.get('email') ?? ''),
        password: String(fields.get('password') ?? ''),
      });
      if (error) throw new Error(error.message || 'La connexion a échoué.');
    });
  }

  return (
    <main className="page">
      <section className="auth-card" aria-labelledby="auth-title">
        <h1 id="auth-title" className="title">
          Time Manager
        </h1>
        {loading ? (
          <p>Chargement…</p>
        ) : session ? (
          <>
            <p>Bonjour {session.user.name}</p>
            <p>{session.user.email}</p>
            <button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const { error } = await authClient.signOut();
                  if (error)
                    throw new Error(
                      error.message || 'La déconnexion a échoué.',
                    );
                })
              }
            >
              Se déconnecter
            </button>
          </>
        ) : (
          <>
            <p>Connecte-toi avec ton compte autorisé.</p>
            <button disabled={busy} onClick={() => microsoft()}>
              Se connecter avec Microsoft 365
            </button>
            <p className="auth-help">
              Utilise le compte Microsoft 365 dont l\'adresse email a été ajoutée
              par ton administrateur. L\'association se fait automatiquement à la
              première connexion.
            </p>
            <form onSubmit={login}>
              <label htmlFor="email">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                required
              />
              <label htmlFor="password">Mot de passe Time Manager</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
              <button disabled={busy} type="submit">
                Se connecter
              </button>
            </form>
          </>
        )}
        {(error || callbackError || sessionError) && (
          <p role="alert" className="auth-error">
            {error || callbackError || 'Impossible de vérifier la session.'}
          </p>
        )}
      </section>
    </main>
  );
}
