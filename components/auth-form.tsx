"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  authErrorMessage,
  normalizeUsername,
  validatePassword,
  validateUsername,
} from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";

type Tab = "in" | "up";

export function AuthForm() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [tab, setTab] = useState<Tab>("in");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Correo con el que se registró: activa el panel «REVISA TU CORREO».
  const [sentTo, setSentTo] = useState<string | null>(null);

  const callbackUrl = () => `${window.location.origin}/auth/callback`;

  const changeTab = (next: Tab) => {
    setTab(next);
    setError(null);
    setNotice(null);
  };

  const signIn = async () => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: pass,
    });
    if (error) {
      setError(authErrorMessage(error));
      return;
    }
    router.push("/biblioteca");
  };

  const signUp = async () => {
    const name = normalizeUsername(username);
    const usernameError = validateUsername(name);
    if (usernameError) return setError(usernameError);
    const passError = validatePassword(pass);
    if (passError) return setError(passError);

    const { data: taken, error: lookupError } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", name)
      .maybeSingle();
    if (lookupError) return setError(authErrorMessage(lookupError));
    if (taken) return setError("Ese username ya está ocupado.");

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: pass,
      options: { data: { username: name }, emailRedirectTo: callbackUrl() },
    });
    if (error) return setError(authErrorMessage(error));
    // Con «Confirm email» activo, un correo ya registrado devuelve un usuario sin identidades.
    if (data.user && data.user.identities?.length === 0)
      return setError("Ese correo ya está registrado.");
    setSentTo(email.trim());
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      if (tab === "in") {
        const passError = validatePassword(pass);
        if (passError) setError(passError);
        else await signIn();
      } else {
        await signUp();
      }
    } catch (err) {
      setError(authErrorMessage(err as Error));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (busy || !sentTo) return;
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: sentTo,
        options: { emailRedirectTo: callbackUrl() },
      });
      if (error) setError(authErrorMessage(error));
      else setNotice("Enlace reenviado. Revisa tu bandeja de entrada.");
    } catch (err) {
      setError(authErrorMessage(err as Error));
    } finally {
      setBusy(false);
    }
  };

  const guest = () => {
    router.push("/biblioteca");
  };

  if (sentTo) {
    return (
      <div className="av-auth-wrap fade-in">
        <div className="auth-card">
          <div className="auth-header">
            <div className="mark"></div>
            <h2 className="neon-cyan">REVISA TU CORREO</h2>
          </div>
          <p className="auth-msg">
            Enviamos un enlace de confirmación a <strong>{sentTo}</strong>.
            Ábrelo para activar tu cuenta e iniciar sesión.
          </p>
          {error && (
            <p className="auth-msg error" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="auth-msg ok" role="status">
              {notice}
            </p>
          )}
          <button
            type="button"
            className="btn"
            style={{ width: "100%", marginTop: 8 }}
            onClick={resend}
            disabled={busy}
          >
            {busy ? "ENVIANDO…" : "REENVIAR ENLACE"}
          </button>
          <button
            type="button"
            className="btn ghost"
            style={{ width: "100%", marginTop: 10 }}
            onClick={() => {
              setSentTo(null);
              setError(null);
              setNotice(null);
              setPass("");
              setTab("in");
            }}
          >
            VOLVER A INICIAR SESIÓN
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark"></div>
          <h2 className="neon-cyan">ARCADE VAULT</h2>
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--ink-faint)",
              letterSpacing: "0.16em",
              marginTop: 6,
            }}
          >
            ACCESO AL SISTEMA · v2.6
          </div>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={tab === "in" ? "on" : ""}
            onClick={() => changeTab("in")}
          >
            INICIAR SESIÓN
          </button>
          <button
            type="button"
            className={tab === "up" ? "on" : ""}
            onClick={() => changeTab("up")}
          >
            CREAR CUENTA
          </button>
        </div>

        <form onSubmit={submit} noValidate>
          {tab === "up" && (
            <div className="field slide-in">
              <label htmlFor="auth-user">Username</label>
              <input
                id="auth-user"
                value={username}
                onChange={(e) => setUsername(e.target.value.toUpperCase())}
                placeholder="PX_KAI"
                autoComplete="username"
                autoCapitalize="characters"
                spellCheck={false}
              />
            </div>
          )}
          <div className="field">
            <label htmlFor="auth-email">Correo electrónico</label>
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jugador@vault.gg"
              autoComplete="email"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="auth-pass">Contraseña</label>
            <input
              id="auth-pass"
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="••••••••"
              autoComplete={tab === "in" ? "current-password" : "new-password"}
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
            {busy
              ? "PROCESANDO…"
              : tab === "in"
                ? "ENTRAR AL VAULT"
                : "CREAR CUENTA"}
          </button>
        </form>

        <button
          type="button"
          className="btn ghost"
          style={{ width: "100%", marginTop: 10 }}
          onClick={guest}
        >
          JUGAR COMO INVITADO
        </button>

        <div className="auth-divider">O CONTINÚA CON</div>
        <div className="social">
          <button className="btn ghost" type="button" disabled>
            ◆ GOOGLE
          </button>
          <button className="btn ghost" type="button" disabled>
            ▣ GITHUB
          </button>
        </div>
        <div className="auth-soon">PRÓXIMAMENTE</div>

        <div
          style={{
            marginTop: 18,
            textAlign: "center",
            fontSize: 11,
            color: "var(--ink-faint)",
            letterSpacing: "0.1em",
          }}
        >
          AL ENTRAR ACEPTAS LOS TÉRMINOS DEL SALÓN ARCADE
        </div>
      </div>
    </div>
  );
}
