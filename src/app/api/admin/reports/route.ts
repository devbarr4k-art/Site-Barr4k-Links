import { NextResponse } from "next/server";
import { isLoggedIn } from "@/lib/auth";
import { canSave } from "@/lib/config";
import { cleanReport, deleteReport, listReports, reportExists, saveReport } from "@/lib/reports";
import { SLUG_RE } from "@/lib/report-types";

const deny = () => NextResponse.json({ error: "Faça login de novo." }, { status: 401 });

export async function GET() {
  if (!(await isLoggedIn())) return deny();
  try {
    return NextResponse.json({ reports: await listReports() });
  } catch (e) {
    console.error("[paineis] listar falhou", e);
    return NextResponse.json({ error: "Não deu pra carregar os painéis." }, { status: 502 });
  }
}

/** Salva um painel. body = { report, oldSlug? } (oldSlug quando o link foi trocado) */
export async function PUT(req: Request) {
  if (!(await isLoggedIn())) return deny();
  if (!canSave()) return NextResponse.json({ error: "Vercel Blob não está ligado ao projeto." }, { status: 500 });
  const body = (await req.json().catch(() => null)) as { report?: unknown; oldSlug?: unknown } | null;
  const rep = cleanReport({ ...(body?.report as object), updatedAt: new Date().toISOString() });
  if (!rep) return NextResponse.json({ error: "Link inválido: use só letras minúsculas, números e hífen." }, { status: 400 });
  const old = typeof body?.oldSlug === "string" ? body.oldSlug : "";
  try {
    // link novo (ou trocado) não pode pisar em outro painel
    if (old !== rep.slug && (await reportExists(rep.slug))) return NextResponse.json({ error: "Esse link já é de outro painel." }, { status: 409 });
    await saveReport(rep);
    if (old && old !== rep.slug && SLUG_RE.test(old)) await deleteReport(old);
  } catch (e) {
    console.error("[paineis] salvar falhou", e);
    return NextResponse.json({ error: "Erro ao salvar: " + (e as Error).message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, report: rep });
}

export async function DELETE(req: Request) {
  if (!(await isLoggedIn())) return deny();
  const body = (await req.json().catch(() => null)) as { slug?: unknown } | null;
  if (typeof body?.slug !== "string") return NextResponse.json({ error: "Inválido." }, { status: 400 });
  try {
    await deleteReport(body.slug);
  } catch (e) {
    console.error("[paineis] apagar falhou", e);
    return NextResponse.json({ error: "Não deu pra apagar." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
