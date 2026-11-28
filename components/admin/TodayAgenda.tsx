import type { AgendaItem } from "@/lib/routine-schedule";
import { formatInZone, TR_ZONE } from "@/lib/session-clock";
import { cn } from "@/lib/utils";

/**
 * BUGÜNÜN AKIŞI (28 Kasım, sahibinin isteği: "sağ sol dengeli olsun").
 * Rutinler beş, Veri Sağlığı yedi satır; yan yana sol panelin dibinde
 * ~90 piksel boşluk kalıyordu. Boşluk esnetilmiyor, dolduruluyor: günün
 * planlı yayın saatleri (TR), geçenler dolu noktayla, sıradaki halkayla,
 * araya "Şimdi" işareti. Nokta saatin geçtiğini söyler, yazıldığını değil
 * — yazılma durumu yukarıdaki satırlarda. Panel ızgarada gerilip şerit
 * dibe iniyor: iki panel aynı hatta bitiyor (geçici rotada ölçüldü: 1024
 * ve 1440'ta ikisinin dibi aynı piksel; şerit 1024'te iki sıra).
 */
export function TodayAgenda({ items, now }: { items: AgendaItem[]; now: Date }) {
  if (items.length === 0) return null;
  const nowAt = items.findIndex((item) => !item.past);
  const chip = (item: AgendaItem) => (
    <li
      key={item.key}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-small",
        item.past ? "bg-surface-elevated text-muted" : "bg-surface-elevated text-body",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-2 shrink-0 rounded-full",
          item.past ? "bg-up" : "border-2 border-primary",
        )}
      />
      <span className="numeral font-semibold text-strong">{formatInZone(item.at, TR_ZONE)}</span>
      {item.label}
      <span className="sr-only">{item.past ? " (saati geçti)" : " (sırada)"}</span>
    </li>
  );
  const nowChip = (
    <li key="now" className="inline-flex items-center gap-1.5 px-1 text-small font-semibold text-primary">
      <span aria-hidden className="h-4 w-0.5 rounded-full bg-primary" />
      Şimdi {formatInZone(now, TR_ZONE)}
    </li>
  );
  const list = items.map(chip);
  list.splice(nowAt === -1 ? list.length : nowAt, 0, nowChip);
  return (
    <div className="mt-auto border-t border-line pt-4">
      <p className="mb-2.5 text-small font-semibold text-muted">Bugünün Akışı · Saatler TR</p>
      <ul className="flex flex-wrap items-center gap-2">{list}</ul>
    </div>
  );
}

