import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Solo rutas internas: empieza por "/" y no por "//" ni "/\".
function safeNext(next: string | null): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return null;
  if (next.startsWith("/\\")) return null;
  return next;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  // Detrás de un proxy/balanceador el host público llega en x-forwarded-host; solo se
  // acepta si coincide con el host de SITE_URL (sin SITE_URL se usa siempre el origin).
  const forwardedHost = request.headers.get("x-forwarded-host");
  const siteHost = process.env.SITE_URL
    ? new URL(process.env.SITE_URL).host
    : null;
  const base =
    forwardedHost && forwardedHost === siteHost
      ? `${request.headers.get("x-forwarded-proto") === "http" ? "http" : "https"}://${forwardedHost}`
      : origin;
  const go = (path: string) => NextResponse.redirect(`${base}${path}`);

  if (!code) return go("/login?error=enlace");

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return go("/login?error=enlace");

  if (next) return go(next);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return go("/login?error=enlace");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  return go(profile ? "/biblioteca" : "/perfil/completar");
}
