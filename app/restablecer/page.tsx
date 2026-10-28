import type { Metadata } from "next";
import { ResetForm } from "@/components/reset-form";

export const metadata: Metadata = {
  title: "Restablecer contraseña · Arcade Vault",
};

export default function ResetPage() {
  return <ResetForm />;
}
