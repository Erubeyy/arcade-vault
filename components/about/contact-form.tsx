"use client";

import { useState, useTransition } from "react";
import { sendContactMessage } from "@/app/about/actions";
import { LIMITS } from "@/lib/contact";

type FormState = { name: string; email: string; msg: string };
type FormError = "validation" | "send" | null;

const EMPTY: FormState = { name: "", email: "", msg: "" };

export function ContactForm() {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [website, setWebsite] = useState(""); // honeypot
  const [sent, setSent] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [error, setError] = useState<FormError>(null);
  const [pending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pending) return;
    if (!form.name.trim() || !form.email.trim() || !form.msg.trim()) {
      setShake(true);
      setTimeout(() => setShake(false), 400);
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const res = await sendContactMessage({ ...form, website });
        if (res.ok) setSent(res.name || form.name.trim());
        else setError(res.error);
      } catch {
        setError("send");
      }
    });
  };

  const reset = () => {
    setSent(null);
    setError(null);
    setForm(EMPTY);
    setWebsite("");
  };

  return (
    <form className={"contact-form" + (shake ? " shake" : "")} onSubmit={onSubmit} noValidate>
      {sent === null ? (
        <>
          <div className="field">
            <label htmlFor="cf-name">NOMBRE</label>
            <input
              id="cf-name"
              value={form.name}
              maxLength={LIMITS.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="px_kai"
              autoComplete="name"
            />
          </div>
          <div className="field">
            <label htmlFor="cf-email">CORREO ELECTRÓNICO</label>
            <input
              id="cf-email"
              type="email"
              value={form.email}
              maxLength={LIMITS.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="jugador@vault.gg"
              autoComplete="email"
            />
          </div>
          <div className="field">
            <label htmlFor="cf-msg">MENSAJE</label>
            <textarea
              id="cf-msg"
              rows={5}
              value={form.msg}
              maxLength={LIMITS.msg}
              onChange={(e) => setForm({ ...form, msg: e.target.value })}
              placeholder="Cuéntanos qué tienes en mente…"
            />
          </div>

          {/* Honeypot: invisible para personas, los bots suelen rellenarlo. */}
          <div className="hp-field" aria-hidden="true">
            <label htmlFor="cf-website">Sitio web</label>
            <input
              id="cf-website"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </div>

          {error && (
            <div className="terminal-error" role="alert">
              <div className="term-bar">
                <span className="dot r"></span>
                <span className="dot y"></span>
                <span className="dot g"></span>
                <span className="term-title">VAULT-OS // ERROR</span>
              </div>
              <div className="term-body">
                <div className="line error">
                  &gt;{" "}
                  {error === "validation"
                    ? "DATOS NO VÁLIDOS. REVISA EL CORREO Y LA LONGITUD DE LOS CAMPOS."
                    : "NO PUDIMOS ENVIAR TU MENSAJE. INTÉNTALO DE NUEVO EN UNOS MINUTOS."}
                </div>
                <div className="line dim">Tu mensaje sigue aquí, no se ha perdido nada.</div>
              </div>
            </div>
          )}

          <button className="btn xl press" type="submit" style={{ width: "100%" }} disabled={pending}>
            {pending ? "▶  ENVIANDO…" : error ? "↻  REINTENTAR" : "▶  ENVIAR MENSAJE"}
          </button>
        </>
      ) : (
        <div className="terminal-success">
          <div className="term-bar">
            <span className="dot r"></span>
            <span className="dot y"></span>
            <span className="dot g"></span>
            <span className="term-title">VAULT-OS // TERMINAL</span>
          </div>
          <div className="term-body">
            <div className="line">
              <span className="prompt">vault@arcade:~$</span> ./send_message --to=team
            </div>
            <div className="line dim">[OK] Conectando con servidor…</div>
            <div className="line dim">[OK] Validando contenido…</div>
            <div className="line dim">[OK] Transmitiendo paquete…</div>
            <div className="line success">
              &gt; MENSAJE RECIBIDO. TE RESPONDEREMOS PRONTO. GRACIAS, {sent.toUpperCase()}.
              <span className="caret">_</span>
            </div>
            <div style={{ marginTop: 18 }}>
              <button className="btn ghost" type="button" onClick={reset}>
                ENVIAR OTRO MENSAJE
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
