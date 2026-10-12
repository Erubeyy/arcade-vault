"use server";

import { Resend } from "resend";
import { validateContact, type ContactInput, type ContactResult } from "@/lib/contact";

const FROM = "Arcade Vault <onboarding@resend.dev>";

export async function sendContactMessage(input: ContactInput): Promise<ContactResult> {
  if (!input || typeof input !== "object") return { ok: false, error: "validation" };

  // Honeypot: fake success so bots get no blocking signal.
  if (typeof input.website === "string" && input.website.trim() !== "") {
    return { ok: true, name: "" };
  }

  if (!validateContact(input)) return { ok: false, error: "validation" };

  const name = input.name.trim();
  const email = input.email.trim();
  const msg = input.msg.trim();

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO_EMAIL;
  if (!apiKey || !to) {
    console.error("[contact] RESEND_API_KEY o CONTACT_TO_EMAIL no configuradas");
    return { ok: false, error: "send" };
  }

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: FROM,
      to,
      replyTo: email,
      subject: `[Arcade Vault] Nuevo mensaje de ${name.replace(/[\r\n]+/g, " ")}`,
      text: `Nombre: ${name}\nCorreo: ${email}\n\nMensaje:\n${msg}`,
    });
    if (error) {
      console.error("[contact] Resend rechazó el envío:", error.name);
      return { ok: false, error: "send" };
    }
    return { ok: true, name };
  } catch {
    console.error("[contact] fallo inesperado al enviar");
    return { ok: false, error: "send" };
  }
}
