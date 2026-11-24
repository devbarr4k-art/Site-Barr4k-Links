import type { Metadata } from "next";
import { isLoggedIn } from "@/lib/auth";
import { blobReady, canSave } from "@/lib/config";
import LoginForm from "../LoginForm";
import Reports from "./Reports";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Painéis", robots: { index: false }, other: { google: "notranslate" } };

export default async function PaineisPage() {
  if (!(await isLoggedIn())) return <LoginForm />;
  return <Reports canSave={canSave()} canUpload={blobReady()} />;
}
