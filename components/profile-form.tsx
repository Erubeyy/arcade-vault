"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  authErrorMessage,
  normalizeUsername,
  validateUsername,
} from "@/lib/auth";
import { useSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/client";

export function ProfileForm() {
  const router = useRouter();
  const { user, status } = useSession();
  const [supabase] = useState(() => createClient());
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !user) return;
    const name = normalizeUsername(username);
    const invalid = validateUsername(name);
    if (invalid) return setError(invalid);

    setError(null);
    setBusy(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .insert({ id: user.id, username: name });
      if (error) {
        setError(authErrorMessage(error));
        return;
      }
      // Refresca la sesión para que SessionProvider recargue el perfil.
      await supabase.auth.refreshSession();
      router.push("/biblioteca");
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
          <h2 className="neon-cyan">COMPLETAR PERFIL</h2>
        </div>

        {status === "loading" && <p className="auth-msg">Cargando…</p>}

        {status === "guest" && (
          <>
            <p className="auth-msg">
              Necesitas iniciar sesión para elegir tu username.
            </p>
            <Link
              className="btn"
              href="/login"
              style={{ width: "100%", textAlign: "center" }}
            >
              IR A INICIAR SESIÓN
            </Link>
          </>
        )}

        {status === "ready" && (
          <>
            <p className="auth-msg">
              Tu perfil ya está completo: <strong>{user?.username}</strong>.
            </p>
            <Link
              className="btn"
              href="/biblioteca"
              style={{ width: "100%", textAlign: "center" }}
            >
              IR A LA BIBLIOTECA
            </Link>
          </>
        )}

        {status === "needs-profile" && (
          <form onSubmit={submit} noValidate>
            <p className="auth-msg">
              Elige tu username público. Es el nombre que aparecerá en el
              ranking. 3 a 10 caracteres: letras, números y guion bajo.
            </p>
            <div className="field">
              <label htmlFor="profile-user">Username</label>
              <input
                id="profile-user"
                value={username}
                onChange={(e) => setUsername(e.target.value.toUpperCase())}
                placeholder="PX_KAI"
                autoComplete="username"
                autoCapitalize="characters"
                spellCheck={false}
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
              {busy ? "GUARDANDO…" : "GUARDAR USERNAME"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
