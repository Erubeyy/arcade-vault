import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = {
  title: "Acceso · Arcade Vault",
};

export default function LoginPage() {
  // AuthForm lee ?error= con useSearchParams, que exige Suspense con cacheComponents.
  return (
    <Suspense>
      <AuthForm />
    </Suspense>
  );
}
