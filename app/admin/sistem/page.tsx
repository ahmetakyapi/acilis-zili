import { Suspense } from "react";
import { PageHeader } from "@/components/ui/primitives";
import { ADMIN_SECTIONS, adminDocTitle } from "@/lib/admin-sections";
import {
  AdminPanel,
  AdminPanelSkeleton,
  AdminPanelTitle,
  HEALTH_LABEL,
  HealthList,
  HealthMark,
  HealthRow,
  StatBox,
  StatGrid,
  StatGridSkeleton,
  type HealthTone,
} from "@/components/admin/AdminUI";
import {
  getCronPulse,
  getHealthChecks,
  type HealthCheck,
} from "@/lib/admin-data";
import { requireAdmin } from "@/lib/admin";
import { getStatus } from "@/lib/data";
import { adminStamp, agoLabel } from "@/lib/admin-format";
import { formatInZone, TR_ZONE, zoneDateKey } from "@/lib/session-clock";
import { addEtDays, ET_ZONE } from "@/lib/market-hours";
import { cn } from "@/lib/utils";

/**
 * Sistem — verinin durumu.
 *
 * Bu sayfa "her şey yolunda" demeyi de bir iş sayıyor: sağlıklı satırlar
 * gizlenmiyor. Özet ekranı yalnızca sorunluları gösteriyor çünkü orada soru
 * "bakmam gereken bir şey var mı"; burada soru "neyin durumu ne" ve cevabın
 * tamamı görünmeli.
 *
 * AMA SORUNLU OLAN ÖNCE (23 Eylül denetimi). Sağlık kutusu "3 Satır ·
 * Aşağıdaki Listede İşaretli" diyordu ve üç sorunlu satır üç ayrı panelde,
 * sağlıklı satırlarla aynı görünüşte, sekiz piksellik bir noktayla
 * ayrılıyordu. Şimdi kutu sorunların ADINI söylüyor, her liste sorunlu
 * satırla başlıyor ve o satır kendi tonunun zeminine geçiyor.
 *
 * Renk TEK BAŞINA bilgi taşımıyor: her satırda noktanın yanında "Sağlıklı /
 * Dikkat / Sorunlu" yazıyor.
 */

/* Her bölümün kendi sekme başlığı: altısı "Yönetim · Açılış Zili"
   paylaşıyordu ve tarayıcı sekmesi, geçmiş, ekran okuyucu bölümleri
   ayıramıyordu. */
export const metadata = { title: adminDocTitle(ADMIN_SECTIONS.system.title) };

export default async function SystemPage() {
  /* Yetki kapısı SAYFADA da: layout yumuşak gezinmede yeniden koşmuyor. */
  await requireAdmin();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Yönetim"
        title={ADMIN_SECTIONS.system.title}
        subtitle={ADMIN_SECTIONS.system.subtitle}
      />
      <Suspense fallback={<StatGridSkeleton boxes={3} cols={3} compact />}>
        <Pulse />
      </Suspense>

      <Suspense fallback={<ChecksSkeleton />}>
        <Checks />
      </Suspense>

      <ReadStamp />
    </div>
  );
}

/**
 * Sayfanın okunduğu an, İstanbul saatiyle — ekran sırasının son satırı
 * (CLAUDE.md, "Ekran düzeni" 7). Bu ekranın değerleri çizim anında
 * hesaplanıyor ("4 Dakika Önce", "Bekleniyor"); açık bırakılan sekmede
 * hangi ana göre yazıldıklarını söyleyen tek yer bu satır. Saat bir dönem
 * Seans kutusunun künyesinde "Sunucu" adıyla duruyordu — oysa o İstanbul
 * saatiydi, sunucu UTC'de koşuyor.
 */
function ReadStamp() {
  return (
    <p className="text-tiny text-muted">
      <span className="numeral">{formatInZone(new Date(), TR_ZONE)} TR Okundu</span>
    </p>
  );
}

/**
 * Önem sırası — listeler ve Sağlık kutusu bu sırayla diziyor: sorunlu,
 * dikkat, sonra geri kalan her şey veri katmanının okuma sırasında.
 *
 * YALNIZCA İLGİ İSTEYEN ÖNE ÇIKIYOR. Koşullu (`info`) ve beklemedeki
 * (`idle`) satırlar da bir dönem sağlıklıların önüne alındı ve Rutinler
 * listesi iki "Koşullu" satırla açılıyordu (Mercek, Analiz — 390 ve 1440,
 * ölçüldü): hüküm taşıyan Günlük Bülten üçüncü sıraya düştü, hafta sonu
 * da "Planlı Değil" diyen Teknik Analiz en üste çıkıyordu. İkisi de sorun
 * değil; sıralamayı yalnızca sorun bozuyor.
 */
const TONE_RANK: Record<HealthTone, number> = {
  down: 0,
  warn: 1,
  info: 2,
  idle: 2,
  ok: 2,
};

/** Önem sırasına göre dizer; aynı tondaki satırlar veri katmanının sırasında kalır. */
function bySeverity(checks: HealthCheck[]): HealthCheck[] {
  return [...checks].sort((a, b) => TONE_RANK[a.tone] - TONE_RANK[b.tone]);
}

const needsAttention = (tone: HealthTone) => tone === "warn" || tone === "down";

/** Sağlık kutusunun künyesinde adı yazılan en fazla satır — fazlası sayıyla. */
const NAMED_PROBLEMS = 3;

/* Gün öneki: "Yarın", yoksa kısa gün adı ("Pzt"). İstanbul takvim günüyle —
   saat de İstanbul saatiyle yazılıyor. */
const WEEKDAY = new Intl.DateTimeFormat("tr-TR", { timeZone: TR_ZONE, weekday: "short" });

/**
 * Saat ve dilim künyesi tek parça: "16:30 TR". Dar kutuda künye sarınca
 * "09:30" bir satırda, "NY" alttakinde kalıyordu (390, ölçüldü) — birimi
 * sayıdan koparmama kuralı (`tieFigures`) saat için de geçerli.
 */
const zoned = (at: Date, zone: string, tag: "TR" | "NY") => `${formatInZone(at, zone)}\u00A0${tag}`;

/**
 * Sıradaki ZİL — açılış ya da kapanış, TR önce: "Açılış Pzt 16:30 TR ·
 * 09:30 NY".
 *
 * `nextTransition` DEĞİL (23 Eylül denetimi). Kutu "Sonraki Geçiş" adıyla
 * onu basıyordu ve o alan ekran tazelemesinin sınırı: New York gece yarısını
 * da sayıyor. Akşamdan sonra ve hafta sonu kutu "07:00 · Seans Anlatısı
 * Burada Değişir" diyordu — o saatte seansla ilgili hiçbir şey değişmiyor.
 * Gün de yazılmıyordu: cuma gecesi sıradaki gerçek zil pazartesi. Zil
 * `nextOpen` ile `nextClose`un erkeni; ana seans açıkken kapanış, değilse
 * açılış.
 */
function nextBell(
  status: { nextOpen: Date; nextClose: Date },
  now: Date,
): string {
  const closing = status.nextClose < status.nextOpen;
  const at = closing ? status.nextClose : status.nextOpen;
  const day = zoneDateKey(at, TR_ZONE);
  const today = zoneDateKey(now, TR_ZONE);
  const prefix =
    day === today ? "" : day === addEtDays(today, 1) ? "Yarın " : `${WEEKDAY.format(at)} `;
  return `${closing ? "Kapanış" : "Açılış"} ${prefix}${zoned(at, TR_ZONE, "TR")} · ${zoned(at, ET_ZONE, "NY")}`;
}

async function Pulse() {
  const [pulse, status, checks] = await Promise.all([
    getCronPulse(),
    getStatus(),
    getHealthChecks(),
  ]);
  /* Aynı istekte `Checks()` de çağırıyor; ikisi ayrı Suspense sınırında ve
     prop olarak geçmek mümkün değil. `getHealthChecks` bu yüzden `cache()`li
     — yoklamalar iki kez koşmuyor. */
  const problems = bySeverity(checks.filter((c) => needsAttention(c.tone)));
  const worst = problems[0]?.tone;

  /* TITLE CASE — bunlar cümle değil, ızgaranın en büyük puntosundaki
     künyeler ve yanlarındaki değerler ("Bugün Koştu", "Tümü Sağlıklı")
     zaten öyle. Sitenin kendi sözlüğü de aynı yazımı kullanıyor
     (`lib/i18n/dictionaries/tr.ts`: "Ön Seans", "Akşam Seansı",
     "Hafta Sonu"); panel ondan sapmamalı. */
  const sessionLabel: Record<string, string> = {
    regular: "Ana Seans Açık",
    "pre-market": "Ön Seans",
    "after-hours": "Akşam Seansı",
    // Yarım günde `holiday` erken kapanış kaydı taşır; tatil değil.
    closed: status.holiday && !status.tradingToday
      ? `Tatil · ${status.holiday.nameTr}`
      : status.isWeekend
        ? "Hafta Sonu"
        : "Kapalı",
  };

  const now = new Date();

  /* SENKRONUN DURUMU TAKVİMDEN, İZİ KENDİ DAMGASINDAN (lib/admin-data.ts →
     `getCronPulse`). Kutu 05:14 ET'de "Bugün Koştu · Sağlıklı" diyordu —
     koşum 13:30 TR'de; damgayı hisse sayfası yazmıştı. Durum sözcüğü
     `status`ta, `delta` yalnızca değişim için (AdminUI → `StatBox`).
     Koştuysa künye koşumun kendi saati ve yaşı ("13:30 TR · 4 Dakika
     Önce"); koşmadıysa beklenen saat ve son iz. */
  const iz = pulse.ok && pulse.data.lastRun ? `Son İz ${adminStamp(pulse.data.lastRun, now)}` : "İz Yok";
  const cron = !pulse.ok
    ? null
    : pulse.data.state === "ran" && pulse.data.lastRun
      ? {
          value: "Bugün Koştu",
          sub: `${zoned(pulse.data.lastRun, TR_ZONE, "TR")} · ${agoLabel(pulse.data.lastRun, now)}`,
          status: { tone: "ok" as const, label: "Sağlıklı" },
        }
      : pulse.data.state === "waiting"
        ? {
            value: "Bekleniyor",
            sub: `${pulse.data.dueTr}\u00A0TR · ${iz}`,
            status: { tone: "idle" as const, label: "Beklemede" },
          }
        : pulse.data.state === "missed"
          ? {
              value: "Koşmadı",
              sub: `${pulse.data.dueTr}\u00A0TR · ${iz}`,
              status: { tone: "down" as const, label: "Kontrol Et" },
            }
          : {
              value: "Planlı Değil",
              sub: `Hafta Sonu · ${iz}`,
              status: { tone: "idle" as const, label: "Planlı Değil" },
            };

  return (
    /* ÜÇ KUTU, SAĞLIK ÖNDE (23 Eylül denetimi). Dört kutunun ikisi (Seans,
       Sonraki Geçiş) sağlık verisi değildi ve sayfanın tek sorusu — neyin
       bozuk olduğu — dördüncü kutuda, "3 Satır" diye bir sayıyla
       cevaplanıyordu. Şimdi ilk kutu sorunları ADIYLA sayıyor ve rengini
       durumundan alıyor; seans ile sıradaki zil tek kutuda. Telefonda ilk
       kutu iki sütunu kaplıyor (1 + 2, delik yok — AdminUI → `StatGrid`). */
    <StatGrid cols={3}>
      <StatBox
        label="Sağlık"
        value={problems.length === 0 ? "Tümü Sağlıklı" : `${problems.length} Uyarı`}
        sub={
          problems.length === 0
            ? `${checks.length} Kontrolün Tamamı Geçti`
            : problems.length <= NAMED_PROBLEMS
              ? problems.map((c) => c.label).join(" · ")
              : `${problems
                  .slice(0, NAMED_PROBLEMS - 1)
                  .map((c) => c.label)
                  .join(" · ")} · ${problems.length - (NAMED_PROBLEMS - 1)} Satır Daha`
        }
        status={worst ? { tone: worst, label: HEALTH_LABEL[worst] } : null}
      />
      <StatBox
        label="Cron"
        value={cron?.value ?? "—"}
        sub={cron?.sub}
        status={cron?.status}
        state={cron ? undefined : "unavailable"}
      />
      {/* TR ÖNCE (CLAUDE.md, "Saat kuralı"). Künye "ET 04:10 · Sunucu
          11:10 TR" diyordu: New York önde ve İstanbul saatine "Sunucu"
          denmişti. Okunduğu an artık sayfanın dibindeki damgada; künye
          seansın bir sonraki ziline ait. */}
      <StatBox
        label="Seans"
        value={sessionLabel[status.session]}
        sub={nextBell(status, now)}
      />
    </StatGrid>
  );
}

/**
 * Sağlık satırı listesi — Rutinler ve Veri Sağlığı aynı satırı çiziyor
 * (AdminUI → `HealthRow`, Özet'in "Dikkat İsteyenler"iyle aynı satır).
 *
 * MODÜL SEVİYESİNDE: bileşen `Checks()` içinde tanımlıydı ve her çizimde
 * yeni bir bileşen türü doğuruyordu (`react-hooks/static-components`).
 *
 * Sorunlu satırlar Özet ekranındaki "Dikkat İsteyenler" listesine
 * kendiliğinden düşüyor — orası zaten `tone` süzüyor, yeni bir bant açmaya
 * gerek yok.
 *
 * BOŞ GRUP OKUNAMAMIŞ GRUPTUR. Okunamayan rutin satırları bir dönem Veri
 * Sağlığı'na göçüyordu ve Rutinler başlığının altında boş bir liste
 * kalıyordu. Veri katmanı artık grubu koruyor (`failed(label, group)`);
 * yine de boş bir grup "sorun yok" diye okunmasın diye söyleniyor.
 */
function CheckList({ items }: { items: HealthCheck[] }) {
  if (items.length === 0) {
    return <p className="py-6 text-center text-base text-brass-ink">Bu grup okunamadı.</p>;
  }
  return (
    <HealthList>
      {bySeverity(items).map((check) => (
        <HealthRow
          key={check.label}
          tone={check.tone}
          label={check.label}
          note={check.note}
          value={check.value}
          status={check.status}
          tint
        />
      ))}
    </HealthList>
  );
}

async function Checks() {
  const checks = await getHealthChecks();
  const keys = bySeverity(checks.filter((c) => c.group === "key"));
  const data = checks.filter((c) => c.group === "data");
  const routines = checks.filter((c) => c.group === "routine");
  /* Tanımlı bir anahtarın notu ("Ortam Değişkeni Dolu") panelin künyesini
     tekrarlıyor; not yalnızca bir şey SÖYLÜYORSA basılıyor: eksik anahtar
     ya da çeviri satırı gibi değeri "Tanımlı" olmayan satır. */
  const keyNotes = keys.filter((c) => c.tone !== "ok" || c.value !== "Tanımlı");

  return (
    <div className="flex flex-col gap-6">
      {/* RUTİNLER İLE VERİ SAĞLIĞI YAN YANA (23 Eylül denetimi). Rutinler
          tam genişlikteydi ve satırın adı ile değeri panelin iki ucunda
          duruyordu: 1440'ta aralarında 703–865 piksel, göz "Günlük Bülten"i
          durumuyla eşlemek için ekranı boydan boya geçiyordu. İkisi de
          zamanlı kontrol listesi (5 ve 6 satır); yarım genişlikte ad ile
          değer aynı bakışta. Rutinler yine önce — solda, telefonda üstte:
          sitenin yazılı içeriğini kod dışında koşan beş rutin üretiyor ve
          biri durduğunda ana sayfa eski metni göstermeye devam ediyor.
          `items-start`: kısa liste uzun olanın boyuna gerilmiyor. */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2 lg:items-start">
        <AdminPanel id="rutinler">
          <AdminPanelTitle hint="İçeriği Yazan claude.ai Görevleri · Saatler TR">
            Rutinler
          </AdminPanelTitle>
          <CheckList items={routines} />
        </AdminPanel>

        <AdminPanel id="veri">
          <AdminPanelTitle hint="Sağlayıcı Verisi ve Takvimlerin Güncelliği">
            Veri Sağlığı
          </AdminPanelTitle>
          <CheckList items={data} />
        </AdminPanel>
      </div>

      {/* ANAHTARLAR BİR ŞERİT. Altı evet/hayır satırı 478 piksellik bir
          panel tutuyordu, beşi aynı notu ("ortam değişkeni dolu")
          tekrarlıyordu ve panel yanındaki listenin boyuna gerilip dibinde
          44–62 piksel boş kalıyordu (1440 / 1024, ölçüldü). Şimdi tam
          genişlikte tek sıra: nokta, ad, değer. Eksik anahtar kendi
          tonunun zeminine geçiyor ve notu şeridin altında. */}
      <AdminPanel id="anahtarlar">
        <AdminPanelTitle hint="Ortam Değişkeni Tanımlı mı · Değer Hiçbir Yerde Gösterilmez">
          Anahtarlar
        </AdminPanelTitle>
        {keys.length === 0 ? (
          <p className="py-6 text-center text-base text-brass-ink">Bu grup okunamadı.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {keys.map((check) => (
              <li
                key={check.label}
                className={cn(
                  "flex min-w-0 items-start gap-2 rounded-(--radius-md) px-3 py-2.5 text-base",
                  check.tone === "warn"
                    ? "bg-brass-wash"
                    : check.tone === "down"
                      ? "bg-down-wash"
                      : "bg-surface-elevated",
                )}
              >
                <HealthMark tone={check.tone} />
                <span className="min-w-0">
                  <span className="block font-semibold text-strong">{check.label}</span>
                  <span
                    className={cn(
                      "block text-small",
                      check.tone === "warn"
                        ? "text-brass-ink"
                        : check.tone === "down"
                          ? "text-down"
                          : "text-muted",
                    )}
                  >
                    {check.value}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex flex-col gap-1.5 border-t border-line pt-3 text-small text-muted">
          {keyNotes.map((check) => (
            <p key={check.label}>
              <span className="font-semibold text-body">{check.label}</span> · {check.note}
            </p>
          ))}
          <p>
            Eksik anahtar sayfayı çökertmez: ilgili kart &ldquo;veri
            alınamadı&rdquo; gösterir ve gerisi çalışmaya devam eder.
          </p>
        </div>
      </AdminPanel>
    </div>
  );
}

/**
 * Listelerin yer tutucusu — gerçek düzenin iskeleti: iki liste yan yana,
 * altında şerit. Ölçüler 1440'taki gerçek panellerden: notlu sağlık
 * satırı ortalama 61 piksel (Rutinler 424 = başlık bloğu ve dolgu 118,5 +
 * 5 × 61; Veri Sağlığı 486), şerit ve notları 130 piksel (Anahtarlar 249).
 */
function ChecksSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2 lg:items-start">
        <AdminPanelSkeleton rows={5} rowHeight={61} />
        <AdminPanelSkeleton rows={6} rowHeight={61} />
      </div>
      <AdminPanelSkeleton rows={2} rowHeight={65} />
    </div>
  );
}
