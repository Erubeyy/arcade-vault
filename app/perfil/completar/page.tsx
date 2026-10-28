import type { Metadata } from "next";
import { ProfileForm } from "@/components/profile-form";

export const metadata: Metadata = {
  title: "Completar perfil · Arcade Vault",
};

export default function CompleteProfilePage() {
  return <ProfileForm />;
}
