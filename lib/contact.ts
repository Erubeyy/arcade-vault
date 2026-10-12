export interface ContactInput {
  name: string;
  email: string;
  msg: string;
  website?: string; // honeypot
}

export type ContactResult =
  | { ok: true; name: string }
  | { ok: false; error: "validation" | "send" };

export const LIMITS = { name: 60, email: 120, msg: 2000 };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateContact(input: ContactInput): boolean {
  const { name, email, msg } = input;
  if (typeof name !== "string" || typeof email !== "string" || typeof msg !== "string") {
    return false;
  }
  const n = name.trim();
  const e = email.trim();
  const m = msg.trim();
  if (!n || !e || !m) return false;
  if (n.length > LIMITS.name || e.length > LIMITS.email || m.length > LIMITS.msg) return false;
  return EMAIL_RE.test(e);
}
