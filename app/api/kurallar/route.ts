import { NextResponse } from "next/server";
import { checkBearer } from "@/lib/api-auth";
import { KURAL_GOREVLERI, isKuralGorevi, kurallariOku } from "@/lib/kurallar";

/**
 * Rutin kuralları — `GET /api/kurallar?gorev=mercek|bilanco|gunluk|haftalik`.
 *
 * Ortak kurallar + göreve özgü ek, `text/markdown`. Gerekçe ve taslak
 * kapısı `lib/kurallar.ts`te. Anahtar `BRIEF_SECRET`.
 */
export async function GET(request: Request) {
  const auth = checkBearer(request, process.env.BRIEF_SECRET);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const gorev = new URL(request.url).searchParams.get("gorev");
  if (!isKuralGorevi(gorev)) {
    return NextResponse.json(
      { error: "invalid-gorev", expected: KURAL_GOREVLERI.join(" | ") },
      { status: 400 },
    );
  }

  const result = await kurallariOku(gorev);
  if (!result.ok) {
    /* Rutin 503'te koşuyu durdurur: kuralsız yazı yazılmaz. */
    return NextResponse.json(
      { error: result.reason === "draft" ? "rules-draft" : "rules-missing", files: result.files },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  return new Response(result.text, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "X-Kurallar-Surum": result.version,
      "X-Kurallar-Dosyalar": result.files.join(", "),
      "Cache-Control": "no-store",
    },
  });
}
