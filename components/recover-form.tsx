"use client";

import Link from "next/link";
import { useState } from "react";
import { authErrorMessage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";

export function RecoverForm() {
  const [supabase] = useState(() => createClient());
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const value = email.trim();
    if (!value) return setError("Escribe tu correo electrónico.");

    setError(null);
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(value, {
        redirectTo: `${window.location.origin}/auth/callback?next=/restablecer`,
      });
      if (error) setError(authErrorMessage(error));
      else setSentTo(value);
    } catch (err) {
      setError(authErrorMessage(err as Error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark"></div>
          <h2 className="neon-cyan">
            {sentTo ? "REVISA TU CORREO" : "RECUPERAR CONTRASEÑA"}
          </h2>
        </div>

        {sentTo ? (
          <p className="auth-msg">
            Si <strong>{sentTo}</strong> tiene una cuenta, le enviamos un
            enlace para crear una contraseña nueva.
          </p>
        ) : (
          <form onSubmit={submit} noValidate>
            <p className="auth-msg">
              Escribe el correo de tu cuenta y te enviaremos un enlace para
              restablecer la contraseña.
            </p>
            <div className="field">
              <label htmlFor="recover-email">Correo electrónico</label>
              <input
                id="recover-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jugador@vault.gg"
                autoComplete="email"
                required
              />
            </div>

            {error && (
              <p className="auth-msg error" role="alert">
                {error}
              </p>
            )}

            <button
              className="btn lg"
              type="submit"
              style={{ width: "100%", marginTop: 8 }}
              disabled={busy}
            >
              {busy ? "ENVIANDO…" : "ENVIAR ENLACE"}
            </button>
          </form>
        )}

        <Link
          className="btn ghost"
          href="/login"
          style={{ width: "100%", marginTop: 10, textAlign: "center" }}
        >
          VOLVER A INICIAR SESIÓN
        </Link>
      </div>
    </div>
  );
}
