"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useSession } from "@/lib/session";

export function Nav() {
  const pathname = usePathname();
  const { user, status, signOut } = useSession();
  const [open, setOpen] = useState(false);

  const isHome = pathname === "/";
  const isLibrary = pathname.startsWith("/biblioteca") || pathname.startsWith("/juegos");
  const isHall = pathname.startsWith("/salon");
  const isAbout = pathname.startsWith("/about");
  const isAuth = pathname.startsWith("/login");
  const close = () => setOpen(false);

  return (
    <>
      <nav className="av-nav">
        <Link className="logo" href="/" onClick={close}>
          <div className="logo-mark"></div>
          <div className="logo-text neon-cyan">
            ARCADE <span className="neon-magenta">VAULT</span>
          </div>
        </Link>
        <div className="links">
          <Link className={isHome ? "active" : ""} href="/">Inicio</Link>
          <Link className={isLibrary ? "active" : ""} href="/biblioteca">Biblioteca</Link>
          <Link className={isHall ? "active" : ""} href="/salon">Salón de la Fama</Link>
          <Link className={isAbout ? "active" : ""} href="/about">Acerca de</Link>
        </div>
        <div className="spacer"></div>
        <div className="coin-counter">
          <span className="coin"></span>
          <span>CRÉDITOS · 03</span>
        </div>
        {status === "ready" && user ? (
          <button className="btn ghost auth-btn" onClick={signOut} title="Cerrar sesión">
            {user.username} · SALIR
          </button>
        ) : status === "needs-profile" ? (
          <>
            <Link className="btn auth-btn" href="/perfil/completar">COMPLETAR PERFIL</Link>
            <button className="btn ghost auth-btn" onClick={signOut} title="Cerrar sesión">SALIR</button>
          </>
        ) : (
          <Link
            className="btn auth-btn"
            href="/login"
            style={status === "loading" ? { visibility: "hidden" } : undefined}
          >
            Iniciar Sesión
          </Link>
        )}
        <button className="btn ghost hamburger" onClick={() => setOpen(true)} aria-label="Menú">≡</button>
      </nav>

      <div className={"av-mobile-backdrop" + (open ? " open" : "")} onClick={close}></div>
      <aside className={"av-mobile-panel" + (open ? " open" : "")}>
        <div className="pixel neon-cyan" style={{ fontSize: 11, marginBottom: 16 }}>MENÚ</div>
        <Link className={isHome ? "active" : ""} href="/" onClick={close}>Inicio</Link>
        <Link className={isLibrary ? "active" : ""} href="/biblioteca" onClick={close}>Biblioteca</Link>
        <Link className={isHall ? "active" : ""} href="/salon" onClick={close}>Salón de la Fama</Link>
        <Link className={isAbout ? "active" : ""} href="/about" onClick={close}>Acerca de</Link>
        {status === "ready" && user ? (
          <a onClick={() => { close(); signOut(); }}>Cerrar sesión ({user.username})</a>
        ) : status === "needs-profile" ? (
          <>
            <Link href="/perfil/completar" onClick={close}>COMPLETAR PERFIL</Link>
            <a onClick={() => { close(); signOut(); }}>Cerrar sesión</a>
          </>
        ) : status === "guest" ? (
          <Link className={isAuth ? "active" : ""} href="/login" onClick={close}>Iniciar Sesión</Link>
        ) : null}
        <div style={{ flex: 1 }}></div>
        <div className="pixel" style={{ fontSize: 9, color: "var(--ink-faint)", letterSpacing: "0.16em" }}>
          CRÉDITOS · 03
        </div>
      </aside>
    </>
  );
}
