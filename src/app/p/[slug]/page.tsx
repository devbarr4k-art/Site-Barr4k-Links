import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getReport } from "@/lib/reports";
import ReportView from "./ReportView";

// barr4k.com/trader/p/<link>: sempre lê a versão salva mais recente (editada no /admin/paineis)
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const rep = await getReport((await params).slug);
  return {
    title: rep ? `${rep.panelName}${rep.userName ? ` · ${rep.userName}` : ""}` : "barr4k",
    robots: { index: false, follow: false },
    other: { google: "notranslate" },
  };
}

export default async function ReportPage({ params }: Props) {
  const rep = await getReport((await params).slug);
  if (!rep) notFound();
  return <ReportView report={rep} />;
}
