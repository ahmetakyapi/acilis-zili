import { Fragment } from "react";
import type { VerdictKey } from "@/lib/analysis";
import type { Dictionary, Locale } from "@/lib/i18n";
import { distancePct, formatRange, openPlan, riskReward, type OpenSide } from "@/lib/technical";
import { cn, directionOf, directionText, formatPercent, formatPercentPlain, formatPrice } from "@/lib/utils";
import { openSideLabel, openWhyText } from "./open-plan";
import styles from "./Technical.module.css";

type Cell = { kind: "entry" | "target" | "stop" | "sellLevel" | "support" | "resistance"; label: string; value: string | null };

/**
 * Plan şeridi — okuyucunun üç sorusu, üç hücre.
 *
 * Seviyeler bir süre çizginin altında lejant olarak duruyordu: "Stop ·
 * Alım Bölgesi · Hedefler" ve 11 punto sayılar. Sorunun kendisi yazılı
 * değildi; okuyucu "alım bölgesi"nin alım yeri olduğunu, "hedef"in satış
 * yeri olduğunu kendi çeviriyordu. Hücreler soruyu başlık olarak taşıyor
 * (NEREDEN ALINIR / NEREDE SATILIR / NEREDE VAZGEÇİLİR) ve sayı büyük.
 *
 * Görüşe göre hücreler değişiyor:
 *   · alım planı varsa (AL, bölgeli TUT): alım · satış · vazgeçme. Risk /
 *     getiri oranı liste kartında altındaki rayda (`PlanRail`), detay
 *     kapağında bu bileşenin `lg` dalında.
 *   · SAT: önce "Nerede Satılır" (tepkide satış seviyeleri), sonra "Nereden
 *     Alınır" → "Alım Yok · Destek" — plan alım planı değil, ama düşüşün
 *     ilk durağı rutinin desteği.
 *   · bölgesiz TUT: "Nereden Alınır" → "Bölge Yok · Destek", "Nerede
 *     Satılır" → direnç (31 Ekim; eskiden "En Yakın Destek / Direnç").
 *     AYNI GÜN: fiyat ve en az bir seviye varken kart ve detay kapağı
 *     bölgesiz TUT'u bu şeritle değil `OpenRange` ile çiziyor (durum adı,
 *     destek—fiyat—direnç ekseni, koşul cümlesi). Bu dal yalnız fiyatsız
 *     ya da seviyesiz bölgesiz TUT'a kaldı.
 *   Plansız iki hâlde altta planın neden olmadığını söyleyen tek cümle.
 *
 * "Bu Yayında Yok" hücresi boş bırakılmıyor: AL'da hedef zorunlu ama TUT'ta
 * bölge var hedef olmayabilir; sessiz bir boşluk "unutulmuş" gibi okunur.
 */
export function PlanStrip({
  verdict,
  entryLow,
  entryHigh,
  stop,
  targets,
  supports,
  resistances,
  size = "sm",
  price = null,
  showWhy = true,
  locale,
  t,
}: {
  verdict: VerdictKey;
  entryLow: number | null;
  entryHigh: number | null;
  stop: number | null;
  targets: readonly number[];
  supports: readonly number[];
  resistances: readonly number[];
  /** `lg`: detail level board and risk comparison; rows stack on phones. */
  size?: "sm" | "lg";
  /** `lg`: hücrenin dibindeki "Fiyata Uzaklık" künyesinin ölçüsü. İki
   *  ölçüde de plansız görüşün hâli (seviyeye doğru / seviyede / geçildi)
   *  buna göre — verilmezse rutinin sırası geçerli (`openPlan`). */
  price?: number | null;
  /** Plansız görüşte "neden plan yok" cümlesi şeridin dibinde; liste kartı
   *  onu rayın künyesinde basıyor (`PlanRail`), orada `false`. */
  showWhy?: boolean;
  locale: Locale;
  t: Dictionary;
}) {
  const money = (value: number) => formatPrice(value, locale, { currency: true });
  /* PARA BİRİMİ LİSTEDE BİR KEZ, SONDA. Üç hedef üç kez "$" taşıyınca
     "Nerede Satılır" hücresi sayfanın en uzun satırı oluyordu ve 390
     pikselde etiketin üstüne dayanıyordu. Hepsi aynı para biriminde;
     tekrarlanan sembol bilgi değil gürültü. `formatRange` ile aynı karar. */
  /* AYRAÇ KENDİNDEN ÖNCEKİ SAYIYA BAĞLI. Ayraç ayrı bir kardeş olarak
     yazılıyordu ve satır ondan ÖNCE kırılabiliyordu: masaüstünde üç hedef
     sütuna sığmayınca "941,65 · 955,70" üstte, "· 989,96 $" altta kalıyordu —
     baştaki nokta satırı kırık gösteriyor. Ayraç artık sayıyla aynı kutuda
     ve kutu `nowrap`: bir sayı ile onu izleyen nokta hiç ayrılmıyor.

     KIRILMA NOKTASI AYRI BİR BOŞLUK OLARAK YAZILIYOR. İlk hâlde boşluk da
     `nowrap` kutunun İÇİNDEYDİ (" · ") ve kutular arasında JSX'te hiç boşluk
     yok — yani satırın kırılabileceği tek bir yer kalmamıştı. Kart tek
     sütunlu olduğu için orada görünmedi; detay kapağında hücreler üç sütunlu
     ızgaraya girince "Nerede Satılır" sütunu (üç hedef, 380 piksel) 300
     piksellik sütundan taşıp "Nerede Vazgeçilir"in üstüne biniyordu —
     "989,96 $" ile "889,00 $" üst üste basılıyordu (1440'ta ölçüldü).
     Boşluk artık kutuların ARASINDA duran ayrı bir metin düğümü: kırılma
     yeri var, nokta yine önceki sayıya yapışık.

     AYRAÇ TİRE, NOKTA DEĞİL. Nokta bu sayfada künye ayracı ("Seans İçi ·
     19:45 TR"); üç hedef aynı işaretle dizilince üç ayrı künye gibi
     okunuyordu. Tire "seviyeden seviyeye" der — aralık yazımıyla
     (`formatRange`) aynı işaret.

     TİRE DE GERİ ALINDI: OK (→), 23 Eylül. "Aralıkla aynı işaret" tam da
     kusurdu. Hemen üstteki satır bir ARALIK ("Nereden Alınır 1.821,75 –
     1.876,86 $"), bu satır iki AYRI hedef ("Nerede Satılır 1.952,59 –
     2.354,39 $", SNDK) ve ikisi yan yana aynı görünüyordu: iki hedef bir
     satış bölgesi gibi okunuyordu. Ok ne künye noktası ne aralık tiresi;
     "sonra bir sonraki seviye" diyor. Ekran okuyucu oku okumuyor, araya
     virgül koyuyor. Kırılma düzeni yukarıdaki iki kayıtla aynı. */
  const list = (values: readonly number[]) =>
    values.length === 0 ? null : values.map((value, index) => (
      <Fragment key={value}>
        <span className={styles.planItem}>
          {index === values.length - 1 ? money(value) : formatPrice(value, locale)}
          {index < values.length - 1 && (
            <>
              <span className={styles.planSep} aria-hidden> →</span>
              <span className="sr-only">, </span>
            </>
          )}
        </span>
        {index < values.length - 1 && " "}
      </Fragment>
    ));
  const hasEntry = entryLow !== null && entryHigh !== null;
  const open = openPlan(verdict, price, { entryLow, entryHigh, targets, supports, resistances });

  type StripCell = {
    kind: Cell["kind"];
    label: string;
    value: React.ReactNode;
    /** Açık planda sayının önündeki niteleme ("Bölge Yok · Destek"). */
    qual?: { text: string; tone?: "up" | "down" | "at" };
    /** Açık planda uzaklığın kaynağı — `distanceFor` yerine. */
    side?: OpenSide;
  };
  let cells: StripCell[];
  /* PLANSIZ GÖRÜŞ DE İKİ SORUYU SORUYOR (31 Ekim, sahibinin isteği).
     Bölgesiz TUT "En Yakın Destek / En Yakın Direnç", SAT "Tepkide Satış /
     En Yakın Destek" diye iki satırdı; SanDisk kartına bakan sahibi "neden
     'Nereden Alınır / Nerede Satılır' yok?" diye sordu. Sorular artık AL
     kartıyla aynı adla duruyor ve cevap dürüst: alım tarafında "Bölge Yok"
     (SAT'ta "Alım Yok") ve rutinin verdiği en yakın destek, satış tarafında
     rutinin hedefi ya da direnci. Uydurma seviye yok; sayılar kayıttan,
     hâl fiyatın onlara göre yerinden (`openPlan`). Fiyat seviyeyi geçtiyse
     niteleme bunu söylüyor ("Direnç Geçildi", "Destek Kırıldı") — eskiden
     ray "Dirence 0,09 $ · %0,0" yazabiliyordu.
     SAT'ta satış sorusu önde: görüşün kendisi o. Eski "Sonraki Destek"
     satırı (23 Eylül, ONDS cebini doldurmak için) yerini planın neden
     olmadığını söyleyen cümleye bıraktı — boşluk yine doldu, bu kez
     okuyucunun sorduğu şeyle. */
  if (open) {
    const op = t.technical.openPlan;
    const side = open.verdict;
    const sellKind: Cell["kind"] = side === "sell" ? "sellLevel" : open.sell?.kind === "target" ? "target" : "resistance";
    const qualTone = (s: OpenSide, dir: "up" | "down") => (s.state === "beyond" ? dir : s.state === "at" ? "at" : undefined);
    const buyCell: StripCell = {
      kind: "support",
      label: t.technical.planEntry,
      value: open.buy ? money(open.buy.level) : null,
      qual: {
        text: [side === "sell" ? op.noBuy : op.noZone, open.buy ? openSideLabel(open.buy, side, t) : null].filter(Boolean).join(" · "),
        tone: open.buy ? qualTone(open.buy, "down") : undefined,
      },
      side: open.buy ?? undefined,
    };
    /* SAT'ta rutin iki-üç tepki seviyesi yazıyor ve hepsi satış yeri: liste
       olduğu gibi (geçilmemiş olanlar). TUT'ta dirençler dört tane ve
       satış yeri değil izlenecek tavan: yalnız en yakını. */
    const sellValue = !open.sell
      ? null
      : open.sell.state !== "beyond" && side === "sell"
        ? list(open.sell.levels)
        : money(open.sell.level);
    const sellCell: StripCell = {
      kind: sellKind,
      label: t.technical.planTargets,
      value: sellValue,
      qual: open.sell ? { text: openSideLabel(open.sell, side, t), tone: qualTone(open.sell, "up") } : undefined,
      side: open.sell ?? undefined,
    };
    cells = side === "sell" ? [sellCell, buyCell] : [buyCell, sellCell];
  } else if (hasEntry) {
    cells = [
      { kind: "entry", label: t.technical.planEntry, value: formatRange(entryLow, entryHigh, locale) },
      { kind: "target", label: t.technical.planTargets, value: list(targets) },
      { kind: "stop", label: t.technical.planStop, value: stop !== null ? money(stop) : null },
    ];
  } else {
    /* Buraya yalnız fiyatsız bir AL düşer (bölgesiz AL rutinde yok). */
    cells = [
      { kind: "support", label: t.technical.planNearestSupport, value: supports[0] !== undefined ? money(supports[0]) : null },
      { kind: "resistance", label: t.technical.planNearestResistance, value: resistances[0] !== undefined ? money(resistances[0]) : null },
    ];
  }
  const qualOf = (cell: StripCell) =>
    cell.qual ? (
      <span className={styles.planQual} data-tone={cell.qual.tone}>
        {cell.qual.text}
      </span>
    ) : null;

  // 22 September: the detail cover gets a compact level board and two
  // common-zero risk bars. 23 September: the list card's risk strip moved
  // onto its level rail (`PlanRail`), so the ratio is computed here only.
  if (size === "lg") {
    const rr = hasEntry ? riskReward(entryHigh, stop, targets) : null;
    const labels: Partial<Record<Cell["kind"], string>> = {
      entry: t.technical.entryZone, target: t.technical.targetsLabel, stop: t.technical.stop,
    };
    const maxLeg = rr ? Math.max(rr.riskAbs, rr.rewardAbs) : 1;
    /* HÜCRENİN DİBİ BOŞTU, ŞİMDİ UZAKLIK (18 Ekim). Üç hücre sağdaki risk
       kolonunun boyuna geriliyordu ve sayının altında 1280'de ~55 piksellik
       renkli bir boşluk kalıyordu (hücre 127 piksel). Künyeyle içerik
       hücrenin dibine kadar iniyor: son çocuğun altında yalnız 14 piksellik
       iç boşluk (ölçüldü, 1280, üç hücre aynı hatta). Boşluk
       esnetilmez, doldurulur: okuyucunun hücreye bakınca sorduğu ikinci
       soru "fiyat buna ne kadar uzak". Ölçü fiyat haritasının "Fiyata
       Uzaklık" sütunuyla AYNI (`distancePct(seviye, fiyat)`) — aynı sayı iki
       yerde aynı kaynaktan. Bölgedeyken yüzde değil söz: bölgenin içinde
       "uzaklık" yok. Birden çok hedefte en yakını ölçülüyor. */
    const distanceFor = (kind: Cell["kind"], side?: OpenSide): "inZone" | "atLevel" | { pct: number } | null => {
      if (price === null) return null;
      /* Açık planda uzaklık hücrenin KENDİ seviyesine (geçilmişse geçilen
         seviyeye; işaret yönü söylüyor). Seviyedeyken yüzde değil söz:
         "%0,0" bir ölçü gibi okunuyor ama söylediği "tam orada". */
      if (side) {
        if (side.state === "at") return "atLevel";
        const pct = distancePct(side.level, price);
        return pct === null ? null : { pct };
      }
      let level: number | null | undefined = null;
      if (kind === "entry" && entryLow !== null && entryHigh !== null) {
        if (price >= entryLow && price <= entryHigh) return "inZone";
        level = price > entryHigh ? entryHigh : entryLow;
      } else if (kind === "target") level = targets[0];
      else if (kind === "sellLevel") level = (targets.length ? targets : resistances)[0];
      else if (kind === "stop") level = stop;
      else if (kind === "support") level = supports[0];
      else if (kind === "resistance") level = resistances[0];
      const pct = distancePct(level ?? null, price);
      return pct === null ? null : { pct };
    };
    return <div className={styles.planOverview} data-has-risk={!!rr}>
      <dl className={styles.overviewCells} style={{ "--cells": cells.length } as React.CSSProperties}>
        {cells.map(cell => {
          const away = cell.value === null ? null : distanceFor(cell.kind, cell.side);
          return <div key={cell.label} className={styles.overviewCell} data-kind={cell.kind} data-open={cell.qual ? true : undefined}>
            <dt><i className={styles.legendDot} data-kind={cell.kind} aria-hidden />{cell.qual ? cell.label : labels[cell.kind] ?? cell.label}</dt>
            {cell.qual && <dd className={styles.overviewQual}>{qualOf(cell)}</dd>}
            {(cell.value !== null || !cell.qual) && <dd className={cn("numeral", cell.value === null && styles.planEmpty)}>{cell.value ?? t.technical.planNone}</dd>}
            {away && <dd className={styles.overviewAway}>
              {away === "inZone" ? t.technical.levelInZone : away === "atLevel" ? t.technical.openPlan.atLevel : <>
                {t.technical.levelsNote}{" "}
                <b className={cn("numeral", directionText(directionOf(away.pct)))}>{formatPercent(away.pct, locale, 1)}</b>
              </>}
            </dd>}
          </div>;
        })}
      </dl>
      {rr && <div className={styles.riskComparison}>
        <p><span>{t.technical.riskReward}</span><strong className="numeral">{t.technical.riskRewardValue.replace("{n}", formatPrice(rr.ratio, locale, { digits: 1 }))}</strong></p>
        <dl>{(["risk", "reward"] as const).map(leg => {
          const abs = leg === "risk" ? rr.riskAbs : rr.rewardAbs;
          const pct = leg === "risk" ? rr.riskPct : rr.rewardPct;
          return <div key={leg} data-leg={leg}>
            <dt>{leg === "risk" ? t.technical.riskLeg : t.technical.rewardLeg}</dt>
            <dd><b className="numeral">{money(abs)}</b><span className="numeral">{formatPercentPlain(pct, locale, 1)}</span></dd>
            <span className={styles.riskComparisonTrack} aria-hidden><i style={{ width: `${abs / maxLeg * 100}%` }} /></span>
          </div>;
        })}</dl>
        <small>{t.technical.riskAnchor.replace("{n}", money(rr.anchor))}</small>
      </div>}
    </div>;
  }

  /* RİSK ŞERİDİ BURADAN ÇIKTI (23 Eylül) — liste kartında artık seviye
     çizgisiyle tek bir çizim: `PlanRail`. Kaydı da onunla gitti; oran,
     çapa, ham tutar ve ölçek kararlarının dördü de orada yaşıyor. Burada
     yalnızca üç soru ve üç sayı kalıyor. */
  /* NEDEN CÜMLESİ KUTUNUN İÇİNDE, KIL ÇİZGİYLE AYRI (31 Ekim). Plansız
     şeridin iki satırı "Bölge Yok" diyor ama nedenini söylemiyordu; cümle
     görüşten ve fiyatın seviyelere göre yerinden (`openWhyText`). Yeni bir
     kutu açmıyor — ekran düzeninin "uyarı panelin içinde düz paragraf"
     kuralı. LİSTE KARTINDA BURADA DEĞİL, RAYIN KÜNYESİNDE (`showWhy`):
     kutunun dibinde iki satır tutuyordu ve kart ızgarası satırı komşu
     kartlarla paylaştığı için NVDA kartının plan satırında 24 piksellik
     boş bir cep açıyordu (1440, ölçüldü). Rayda "Fiyata Uzaklık"
     künyesinin yerine geçiyor, yer açmıyor. */
  const why = showWhy && open ? openWhyText(open, t) : null;
  return (
    <div className={styles.planStrip} data-open={why ? true : undefined}>
      <dl className={styles.planCells} style={{ "--cells": cells.length } as React.CSSProperties}>
        {cells.map((cell) => (
          <div key={cell.label} className={styles.planCell} data-kind={cell.kind} data-open={cell.qual ? true : undefined}>
            <dt>
              <i aria-hidden className={styles.legendDot} data-kind={cell.kind} />
              {cell.label}
            </dt>
            <dd className={cn("numeral", cell.value === null && !cell.qual && styles.planEmpty)}>
              {qualOf(cell)}
              {cell.qual && cell.value !== null && " "}
              {cell.value ?? (cell.qual ? null : t.technical.planNone)}
            </dd>
          </div>
        ))}
      </dl>
      {why && <p className={styles.planWhy}>{why}</p>}
    </div>
  );
}
