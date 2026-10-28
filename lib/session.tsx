"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

export interface User {
  id: string;
  email: string | null;
  username: string | null; // null = autenticado sin perfil
}

export type SessionStatus = "loading" | "guest" | "needs-profile" | "ready";

interface SessionValue {
  user: User | null;
  status: SessionStatus;
  signOut: () => Promise<void>;
}

type State = { status: SessionStatus; user: User | null };

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [supabase] = useState(() => createClient());
  const [state, setState] = useState<State>({ status: "loading", user: null });
  const loadId = useRef(0);

  useEffect(() => {
    const apply = async (session: Session | null) => {
      const id = ++loadId.current;
      if (!session) {
        setState({ status: "guest", user: null });
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", session.user.id)
        .maybeSingle();
      if (id !== loadId.current) return; // llegó una sesión más reciente
      const username = data?.username ?? null;
      setState({
        status: username ? "ready" : "needs-profile",
        user: {
          id: session.user.id,
          email: session.user.email ?? null,
          username,
        },
      });
    };

    // No se hacen llamadas a Supabase dentro del callback: se difieren para evitar bloqueos.
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => void apply(session), 0);
    });
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, [supabase]);

  const value = useMemo(
    () => ({ user: state.user, status: state.status, signOut }),
    [state, signOut],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx)
    throw new Error("useSession debe usarse dentro de <SessionProvider>");
  return ctx;
}
