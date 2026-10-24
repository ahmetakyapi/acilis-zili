"use client";

import { useMemo } from "react";
import { InkCanvas } from "@/components/ink/InkCanvas";
import { POSTER_BOX_W, posterBoxHeight, posterScene, type PosterSceneData } from "@/lib/ink/poster";
import { cn } from "@/lib/utils";

/**
 * Posterin tuvali — veriden kurulan sahneyi `InkCanvas`e verir.
 *
 * Sahne nesnesi `useMemo` ile: her çizimde yeni nesne `InkCanvas`in
 * etkisini yeniden kurar ve sahne baştan oynardı. Tuvalin oranı sahnenin
 * kutusundan (`aspect-ratio`), yani yer tutucu gerçek boyu ayırıyor ve
 * çizim gelince sayfa kaymıyor. Tuval `aria-hidden` (InkCanvas); okunan
 * karşılığı yanındaki tablo ve lejant, sahnenin adı `figure`ın etiketinde.
 */
export function DayPosterCanvas({ data, className }: { data: PosterSceneData; className?: string }) {
  const def = useMemo(() => posterScene(data), [data]);
  const ratio = `${POSTER_BOX_W} / ${posterBoxHeight(data)}`;
  return (
    <div className={cn("w-full", className)} style={{ aspectRatio: ratio }}>
      {/* `scene` kayıttaki en yakın sahne (gün şeridi); çizilen `def`. */}
      <InkCanvas scene="dayStrip" def={def} seed={data.seed} className="h-full w-full" />
    </div>
  );
}
