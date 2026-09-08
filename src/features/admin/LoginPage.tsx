import { useState, type FormEvent } from "react";

type LoginPageProps = {
  pending: boolean;
  error: "login" | "access" | null;
  onSignIn(email: string, password: string): Promise<void>;
};

export function LoginPage({ pending, error, onSignIn }: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    void onSignIn(email, password);
  };

  return (
    <main className="admin-login">
      <section className="admin-login__card" aria-labelledby="admin-login-title">
        <p className="admin-eyebrow">Espace organisateur</p>
        <h1 id="admin-login-title">Administration</h1>
        <p className="admin-login__intro">Connectez-vous pour piloter le tournoi.</p>

        {error ? (
          <p className="admin-alert" role="alert">
            {error === "access"
              ? "Accès administrateur impossible. Vérifiez votre compte."
              : "Connexion impossible. Vérifiez vos identifiants."}
          </p>
        ) : null}

        <form className="admin-login__form" onSubmit={submit}>
          <label htmlFor="admin-email">Adresse e-mail</label>
          <input
            id="admin-email"
            name="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />

          <label htmlFor="admin-password">Mot de passe</label>
          <input
            id="admin-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />

          <button type="submit" disabled={pending}>
            {pending ? "Connexion en cours…" : "Se connecter"}
          </button>
        </form>
      </section>
    </main>
  );
}
