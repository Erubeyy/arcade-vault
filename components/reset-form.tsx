"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authErrorMessage, validatePassword } from "@/lib/auth";
import { useSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/client";

export function ResetForm() {
  const router = useRouter();
  const { status } = useSession();
  const [supabase] = useState(() => createClient());
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const invalid = validatePassword(pass);
    if (invalid) return setError(invalid);
    if (pass !== confirm) return setError("Las contraseñas no coinciden.");

    setError(null);
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pass });
      if (error) {
        setError(authErrorMessage(error));
        return;
      }
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
          <h2 className="neon-cyan">NUEVA CONTRASEÑA</h2>
        </div>

        {status === "loading" && <p className="auth-msg">Cargando…</p>}

        {status === "guest" && (
          <>
            <p className="auth-msg">
              Este enlace no es válido o ya caducó. Solicita uno nuevo para
              restablecer tu contraseña.
            </p>
            <Link
              className="btn"
              href="/recuperar"
              style={{ width: "100%", textAlign: "center" }}
            >
              SOLICITAR ENLACE NUEVO
            </Link>
          </>
        )}

        {(status === "ready" || status === "needs-profile") && (
          <form onSubmit={submit} noValidate>
            <div className="field">
              <label htmlFor="reset-pass">Nueva contraseña</label>
              <input
                id="reset-pass"
                type="password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="reset-confirm">Confirmar contraseña</label>
              <input
                id="reset-confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
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
              {busy ? "GUARDANDO…" : "GUARDAR CONTRASEÑA"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
