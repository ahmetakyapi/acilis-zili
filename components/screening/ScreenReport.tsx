import { CheckCircle, WarningCircle, XCircle } from "@phosphor-icons/react/dist/ssr";
import { Panel, PanelHeader } from "@/components/ui/primitives";
import type { Dictionary } from "@/lib/i18n";
import { SCREEN_CATEGORIES, type Check, type CheckStatus, type ScreenCategory } from "@/lib/screening";
import type { ScreenData } from "@/lib/screening-data";
import { gaugeOf } from "@/lib/screening-gauge";
import { NO_VALUE } from "@/lib/utils";
import { checkSentence, formatCheckValue } from "./format";
import styles from "./Screening.module.css";

type T = Dictionary["screening"];
type V = Dictionary["stockVisuals"];

/** Kategori puanının çubuk rengi — kontrollerle aynı üç ton. */
function scoreStatus(score: number | null): CheckStatus {
  if (score === null) return "na";
  if (score >= 70) return "pass";
  if (score >= 40) return "warn";
  return "fail";
}

/** Bankada sağlık kuralları "veri yok" değil "uygulanmaz" — okuyucu
    eksik bir ölçü değil bilinçli bir atlama görmeli. */
export function statusLabel(check: Check, data: ScreenData, t: T): string {
  if (check.status === "na" && check.category === "health" && data.input.financial) return t.status.notApplicable;
  if (check.baseEffect) return t.baseEffectStatus;
  return t.status[check.status];
}

/** Ana görsel: altı kategorinin puanı, ağırlığı ve kaç kuralının ölçüldüğü. */
export function CategoryPanel({ data, t }: { data: ScreenData; t: T }) {
  const gate = data.result.checks.filter((check) => check.category === "gate");
  const failed = gate.filter((check) => check.eliminates);
  const gateStatus: CheckStatus = failed.length ? "fail" : gate.some((c) => c.status === "na") ? "na" : "pass";
  return (
    <Panel>
      <PanelHeader title={t.categoriesTitle} />
      <div className={styles.cats}>
        {data.result.categories.map((entry) => {
          const status = scoreStatus(entry.score);
          return (
            <div key={entry.category} className={styles.cat} data-status={status}>
              <span className={styles.catName}>{t.categories[entry.category]}</span>
              <span className={styles.catScore} data-empty={entry.score === null}>
                {entry.score === null ? t.status.na : Math.round(entry.score)}
              </span>
              <span className={styles.catMeta}>
                {t.weight.replace("{n}", String(entry.weight))} ·{" "}
                {t.measured.replace("{m}", String(entry.measured)).replace("{n}", String(entry.total))}
              </span>
              <span className={styles.track} aria-hidden="true">
                {entry.score !== null && <span style={{ width: `${Math.max(entry.score, 2)}%` }} />}
              </span>
            </div>
          );
        })}
      </div>
      <p className={styles.gate} data-status={gateStatus}>
        <b>
          {t.categories.gate} · {t.status[gateStatus]}
        </b>
        <span>
          {failed.length
            ? failed.map((check) => t.checks[check.id].name).join(", ")
            : t.categoryWhy.gate}
        </span>
      </p>
    </Panel>
  );
}

/** Ölçü ızgarası: her kural, eşiği, ölçüsü ve durumu. */
export function ChecksPanel({ data, locale, t, v }: { data: ScreenData; locale: string; t: T; v: V }) {
  const groups = SCREEN_CATEGORIES.map((category) => ({
    category,
    checks: data.result.checks.filter((check) => check.category === category),
  })).filter((group) => group.checks.length > 0);
  return (
    <Panel>
      <PanelHeader title={t.checksTitle} meta={t.coverage.replace("{n}", String(data.result.coverage))} />
      <div className={styles.colHead} aria-hidden="true">
        <span>{t.colRule}</span>
        <span>{v.colGauge}</span>
        <span>{t.colValue}</span>
        <span>{t.colStatus}</span>
      </div>
      {groups.map((group) => (
        <CheckGroup key={group.category} category={group.category} checks={group.checks} data={data} locale={locale} t={t} v={v} />
      ))}
      {/* Kulvarın okunuşu tek künyede, panelin içinde (ekran düzeni 6). */}
      <p className={styles.gaugeNote}>{v.gaugeNote}</p>
    </Panel>
  );
}

function CheckGroup({
  category,
  checks,
  data,
  locale,
  t,
  v,
}: {
  category: ScreenCategory;
  checks: Check[];
  data: ScreenData;
  locale: string;
  t: T;
  v: V;
}) {
  const measured = checks.filter((check) => check.status !== "na").length;
  return (
    <section className={styles.group}>
      <div className={styles.groupHead}>
        <h3>{t.categories[category]}</h3>
        <span>{t.measured.replace("{m}", String(measured)).replace("{n}", String(checks.length))}</span>
      </div>
      <ul className={styles.rows}>
        {checks.map((check) => {
          const value = formatCheckValue(check, locale, t, "cell");
          return (
            <li key={check.id} className={styles.row} data-status={check.status}>
              <span className={styles.rowName}>{t.checks[check.id].name}</span>
              <span className={styles.rowRule}>{t.checks[check.id].rule}</span>
              <span className={styles.rowValue} data-empty={value === null}>
                {value ?? NO_VALUE /* tek işaret "–" (lib/utils); uzun çizgi "—" idi (10 Kasım) */}
              </span>
              <span className={styles.rowStatus}>
                {/* İKONLU HAP (10 Kasım). Durum noktalı bir rozetti; sitenin
                    yerleşik dili noktalı rozet yerine ikonlu hap
                    (`.claude/rules/arayuz.md` → Görsel Dil) ve aynı panelin
                    altındaki güçlü/zayıf yanlar zaten bu üç ikonu kullanıyor.
                    Ölçülemeyen kuralda ikon yok: hüküm de yok. */}
                <span className={styles.status}>
                  {check.status === "pass" ? (
                    <CheckCircle size={13} weight="fill" aria-hidden="true" />
                  ) : check.status === "warn" ? (
                    <WarningCircle size={13} weight="fill" aria-hidden="true" />
                  ) : check.status === "fail" ? (
                    <XCircle size={13} weight="fill" aria-hidden="true" />
                  ) : null}
                  {statusLabel(check, data, t)}
                </span>
              </span>
              {value !== null && <ThresholdLane check={check} value={value} locale={locale} t={t} v={v} />}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Kulvar künyesinin kenarlara yaklaştığı yer — etiket orada uca yaslanır. */
const LABEL_EDGE = 14;

/**
 * Eşik kulvarı (25 Ekim) — eşik çentik, aradaki fark çubuk.
 * Ölçek ve gerekçe lib/screening-gauge.ts. Çubuğun rengi satırın durumu
 * (rozetle aynı `--st`): geçen farkı yeşil, kalan farkı kırmızı uzanır;
 * bu ekranda renk zaten kuralın hükmü, yeni bir hüküm değil.
 *
 * TEK ÇUBUK + TEK İM (10 Kasım 2026, sahibinin sözü: "böyle nokta nokta ne
 * anlatıyor anlamıyorum; yatayda uzun kalın çizgi seviyorum"). Kulvarda
 * beş katman vardı: geçme tarafının soluk zemini, dikkat sınırının ince
 * çentiği, eşik çentiği, 5 piksellik fark çubuğu ve değerin 11 piksellik
 * noktası (ölçek dışında içi boş halka). Kalan: eşikten değere uzanan 8
 * piksellik dolu çubuk (kulvar 5; dış ucu yuvarlak, eşiğe dayanan ucu düz)
 * ve etiketli eşik çentiği. Çubuğun ucu değerin yeri; nokta onu ikinci kez
 * söylüyordu. Dikkat sınırı satırın rozetinde ("Dikkat"), geçme tarafı
 * çubuğun renginde okunuyor.
 */
function ThresholdLane({ check, value, locale, t, v }: { check: Check; value: string; locale: string; t: T; v: V }) {
  const gauge = gaugeOf(check);
  if (!gauge) return null;
  /* Eşiğin künyesi satırın kendi biçimiyle, ama SADE: eşik bir yön değil
     ("+%10,0" değil "%10"), yuvarlak sayının ",0"ı da gürültü. */
  const threshold = (formatCheckValue({ ...check, value: gauge.spec.pass }, locale, t, "cell") ?? "")
    .replace(/^\+\s?/, "")
    .replace(/[.,]0(?!\d)/, "");
  const width = Math.abs(gauge.valueAt - gauge.passAt);
  const left = gauge.valueAt < gauge.passAt;
  const align = gauge.passAt < LABEL_EDGE ? "start" : gauge.passAt > 100 - LABEL_EDGE ? "end" : "center";
  const aria = v.gaugeAria.replace("{t}", threshold).replace("{v}", value);
  return (
    <span className={styles.lane} role="img" aria-label={aria} title={aria}>
      <span className={styles.laneRail} aria-hidden>
        {width > 0.5 && (
          <i
            className={styles.laneGap}
            data-side={left ? "below" : "above"}
            data-motion-draw="line"
            style={{
              ...(left ? { right: `${100 - gauge.passAt}%` } : { left: `${gauge.passAt}%` }),
              width: `${width}%`,
              /* Fark eşikten büyüyor: değer eşiğin solundaysa sağdan sola. */
              transformOrigin: left ? "right center" : "left center",
            }}
          />
        )}
        <i className={styles.lanePass} style={{ left: `${gauge.passAt}%` }} />
      </span>
      <span className={styles.laneLabel} data-align={align} style={{ left: `${gauge.passAt}%` }} aria-hidden>
        {threshold}
      </span>
    </span>
  );
}

/** Metin: zayıf ve güçlü yanlar, kural cümleleriyle. ZAYIF YANLAR ÖNDE
    (3 Ekim): ekranın en değerli işi kırmızı bayrağı göstermek; güçlü yanlar
    öndeyken okuyucu on beş artıyı okuyup tek eksiye hiç inmiyordu. */
export function SidesPanel({ data, locale, t }: { data: ScreenData; locale: string; t: T }) {
  const byId = new Map(data.result.checks.map((check) => [check.id, check]));
  const pros = data.result.pros.map((id) => byId.get(id)!);
  const cons = data.result.cons.map((id) => byId.get(id)!);
  return (
    <Panel>
      <div className={styles.sides}>
        <section className={styles.side}>
          <h2>{t.consTitle}</h2>
          {cons.length ? (
            <ul className={styles.points}>
              {cons.map((check) => (
                <li key={check.id} data-status={check.status}>
                  {check.status === "fail" ? (
                    <XCircle size={18} weight="fill" aria-hidden="true" />
                  ) : (
                    <WarningCircle size={18} weight="fill" aria-hidden="true" />
                  )}
                  <span>{checkSentence(check, locale, t, "con")}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.none}>{t.noneLabel}</p>
          )}
        </section>
        <section className={styles.side}>
          <h2>{t.prosTitle}</h2>
          {pros.length ? (
            <ul className={styles.points}>
              {pros.map((check) => (
                <li key={check.id} data-status="pass">
                  <CheckCircle size={18} weight="fill" aria-hidden="true" />
                  <span>{checkSentence(check, locale, t, "pro")}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.none}>{t.noneLabel}</p>
          )}
        </section>
      </div>
    </Panel>
  );
}

/**
 * Sıradaki adımlar, okuyucunun kendi kontrolleri ve künyeler. Künyeler
 * panelin İÇİNDE, hairline ile ayrılmış düz paragraflar (ekran düzeni
 * kuralı 6) — yöntem, kaynaklar, banka notu ve tavsiye uyarısı için ayrı
 * kutular açılmıyor.
 */
export function NextPanel({ data, locale, t }: { data: ScreenData; locale: string; t: T }) {
  const pe = data.input.forwardPE;
  const peText =
    pe !== null
      ? new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-US", { maximumFractionDigits: 1 }).format(pe)
      : "";
  return (
    <Panel>
      <PanelHeader title={t.nextTitle} />
      <ol className={styles.steps}>
        {data.result.suggestions.map((id) => (
          <li key={id}>
            {t.suggestions[id]
              .replace("{days}", String(data.input.earningsInDays ?? ""))
              .replace("{pe}", peText)}
          </li>
        ))}
      </ol>
      <PanelHeader title={t.manualTitle} />
      <ol className={styles.steps}>
        {t.manual.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ol>
      <div className={styles.notes}>
        {data.input.financial && <p>{t.financialNote}</p>}
        <p>{t.methodNote}</p>
        <p>{t.sourcesNote}</p>
        <p>
          <strong>{t.notAdvice}</strong>
        </p>
      </div>
    </Panel>
  );
}
