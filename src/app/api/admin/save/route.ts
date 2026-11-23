import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { isLoggedIn } from "@/lib/auth";
import { CONFIG_TAG, canSave, saveConfig, sanitizeConfig } from "@/lib/config";

export async function POST(req: Request) {
  if (!(await isLoggedIn())) return NextResponse.json({ error: "Faça login de novo." }, { status: 401 });
  if (!canSave()) {
    return NextResponse.json({ error: "Vercel Blob não está ligado ao projeto (Storage → Blob na Vercel)." }, { status: 500 });
  }
  const config = sanitizeConfig(await req.json().catch(() => null));
  try {
    await saveConfig(config);
  } catch (e) {
    return NextResponse.json({ error: "Erro ao salvar: " + (e as Error).message }, { status: 500 });
  }
  // A página pública passa a mostrar o novo conteúdo na hora
  revalidateTag(CONFIG_TAG, { expire: 0 });
  revalidatePath("/");
  return NextResponse.json({ ok: true, config });
}
