import type { CSSProperties } from "react";
import { ArrowDown, ArrowUp, ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { LogoTile, Panel, PanelHeader, Skeleton } from "@/components/ui/primitives";
import { themeTitle } from "@/content/themes";
import type { Dictionary, Locale } from "@/lib/i18n";
import type { ThemeBoard as ThemeBoardData, ThemeCard } from "@/lib/theme-board";
import { boardAxis, heatOf } from "@/lib/theme-view";
import { cn, directionOf, directionText, formatPercent, NO_VALUE } from "@/lib/utils";
import { RollingFigure } from "./RollingFigure";
import styles from "./ThemeBoard.module.css";

/**
 * Temalar panosu — `/temalar` dizininin gövdesi (10 Kasım 2026, yeniden tasarım).
 *
 * ÖNCE: kapakta on satırlık sıralama, altında on kartlık asimetrik galeri.
 * Aynı medyan İKİ KEZ yazılıyordu (sıralamada 14 punto, kartta 54 punto) ve
 * on dev renkli rakam on ayrı kutuda duruyordu: her kartın dağılım şeridi
 * kendi kutusunda, kendi "−%3 · 0 · +%3" etiketiyle (10 × 3 = 30 etiket) ve
 * kartlar editoryal sırada olduğu için "hangisi önde" sorusu ancak kapağa
 * geri dönülerek cevaplanıyordu. Dar kartın yanındaki geniş kartta 81
 * piksele varan ölü boşluk (1440, canlı), telefonda sayfa 5.787 piksel.
 *
 * ŞİMDİ: tek pano. Her tema bir SATIR, satırlar günün medyanına göre sıralı
 * ve bütün çubuklar AYNI eksende alt alta: sıfır çizgisi satırlardan
 * kesintisiz geçiyor. Kart sayısı ne olursa olsun pano dolu biter: ızgara
 * yok, yarım satır yok.
 *
 * GÖRSEL SIRALAMA (10 Kasım akşamı, ikinci tur; sahibinin sözü: "Temalar
 * ekranını daha görsel yapmak için…", "şirketlerin adı ve logolar az daha
 * büyüyebilir", "yatayda uzun KALIN çizgi seviyorum"). Sabahki pano
 * okunaklıydı ama KURUYDU: 68 piksellik tablo satırı, 16 punto ad, 22
 * piksellik logolar, 8 piksellik çubuk 391 piksellik sütunun yarısında
 * (en uzun çubuk 160 piksel), yanında ne olduğu künyeden öğrenilen ölçüt
 * çentiği ve 52 piksellik oran çizgisi. Şimdi satır üç şey GÖSTERİYOR:
 *   1. KİM: ad 22/700, altında üyelerin 32 piksellik logoları (ilk altı,
 *      fazlası "+N"; bindirme yok).
 *   2. NE KADAR: sıfırdan medyana 14 piksellik çubuk; medyanın sayısı
 *      çubuğun UCUNDA (ayrı sütunda değil: göz çubuğu izleyip sayıya
 *      varıyor). Eksen simetrik değil, günün aralığı kadar (`boardAxis`):
 *      −%0,35 … +%0,83'lük günde sıfır soldan üçte birde, en uzun çubuk
 *      sütunun ucuna dayanıyor (1440'ta 160 → ~330 piksel).
 *   3. İÇERİDE NE VAR: üye ISI ŞERİDİ. Her üye dolu bir karo, en zayıftan
 *      en güçlüye sıralı (eksenle aynı yön), rengi günlük değişim (ısı haritasının kademeleri,
 *      `heatOf`). Sıralı olduğu için şerit aynı anda yükselen/düşen oranı:
 *      kırmızı blok ile yeşil bloğun sınırı oranın kendisi. Sabahki 52
 *      piksellik iki renkli çizginin ve üye çentiklerinin yerini aldı
 *      (çentik DEĞİL dolu karo: sahibinin "nokta nokta" itirazı). Karonun
 *      üstüne gelince sembol ve yüzde. Yanında sayılar ve iki uç üye
 *      adıyla: "↑ 12 · LLY +%2,10", "↓ 8 · AMGN −%0,42".
 * Karolar PİYASA DEĞERİNE göre değil DEĞİŞİME göre sıralı (brifteki öneri
 * piyasa değeriydi): eş karoda büyüklük zaten okunmuyor, değere göre
 * dizilince renkler karışıp "kaçı yeşil" sorusu sayılmadan cevaplanmıyordu;
 * büyüklük detaydaki haritanın işi.
 *
 * ÖLÇÜT FONU ÇENTİĞİ panodan KALKTI (aynı tur): çubuğun üstünde tek başına
 * duran koyu çentik okurun çözmesi gereken ikinci bir imdi ve günün
 * aralığını aşınca (SMH −%1,47, eksen −%0,35'te bitiyor) uca yapışıp yanlış
 * yeri gösteriyordu. Kıyas detay kapağında, iki kalın çubukla
 * (`ThemeReading`).
 *
 * UÇ TEMALAR TONLA AYRIŞIR: günün en güçlü ve en zayıf temasının satırı
 * yönünün renginde çok hafif yıkanır (%5–6; çip yok, renk duvarı yok).
 * Sabahki "Günün En Güçlüsü" çipi satırda kalktı: aynı bilgi kapakta ve
 * sıranın kendisinde (01 ve son satır). Gece kapaktaki iki uç kutusu da
 * kalktı (app/(app)/temalar/page.tsx → HeroSummary): uçları artık YALNIZ bu ton
 * ve sıra söylüyor.
 *
 * SIRA VERİYE BAĞLI AMA KUTU OYNAMIYOR. Eski galeri sırayı veriye
 * bağlamıyordu ("yedek ile canlı ızgara farklı olur, akışla gelen veri
 * kartları yerinden oynatırdı" — 28 Eylül). O kaygı eş boylu satırlarda
 * yok: yedek aynı sayıda satırı editoryal sırayla ve sayısız basıyor, veri
 * inince satırların İÇİ değişiyor, panonun boyu değil (ana sayfa bandının
 * sıralaması aynı kuralla çalışıyor: `RankBars`; sabah `ThemeRanking`di,
 * aynı gün silindi).
 *
 * Ortak kümenin DIŞINDA kalan tema (yüzdesi başka seansı anlatan) dipte,
 * sayısız ve çubuksuz: bir önceki günün medyanını bugünün ekseninde
 * göstermek onu bugünün en zayıfı gibi okuturdu (28 Eylül denetimi; ana
 * sayfa bandında aynı kural — MarketTexture.tsx → `themeRows`).
 *
 * HAREKET (≤ ~900 ms, opaklık 0'dan başlayan yok): çubuk sıfırdan uzar
 * (`bar-fill`, 700 ms; satır kademesi en çok 5 × `--step`), ısı karoları
 * soldan sağa tonlanır (`--mark`, kademe en çok 10 × `--step` = 400 ms),
 * uçtaki sayı yuvarlanır (`RollingFigure`). Satır `data-draw`: ekranın
 * altındaki satır son karede bekler, girince oynar.
 *
 * ÖLÇÜM: ThemeBoard.module.css başında.
 */

/** Satırda gösterilen logo sayısı; fazlası "+N". */
const ROW_LOGOS = 6;
/** Isı karolarının kademe tavanı: 10 × `--step` (40 ms) = 400 ms. */
const HEAT_STAGGER = 10;
/* Panonun ekseni (`boardAxis`, taban aralık `BOARD_MIN_SPAN`) 10 Kasım
   gecesi lib/theme-view.ts'e taşındı; testi tests/theme-view.test.ts. */

export function ThemeBoard({
  board,
  basis,
  locale,
  t,
}: {
  board: ThemeBoardData;
  /** Ortak ölçeğin seansı; yedekte yok. */
  basis: "session" | "lastClose" | null;
  locale: Locale;
  t: Dictionary;
}) {
  const inScale = (card: ThemeCard) => basis !== null && card.basis === basis && card.median !== null;
  const sorted = basis
    ? [...board.cards].sort((a, b) => {
        if (inScale(a) !== inScale(b)) return inScale(a) ? -1 : 1;
        return (b.median ?? 0) - (a.median ?? 0);
      })
    : board.cards;
  /* Eksen ortak seans kümesi varken (yedekte `basis` yok: sayısız pano). */
  const axis = basis === null ? null : boardAxis(board.cards.filter(inScale).map((card) => card.median!));
  const pre = board.phase === "pre-market";
  const closed = board.phase === "lastClose";
  const pct = (value: number) => formatPercent(value, locale);

  return (
    <Panel className={styles.panel}>
      <PanelHeader
        title={pre ? t.themes.rankTitlePre : closed ? t.themes.rankTitleClose : t.themes.rankTitle}
        meta={t.themes.rankMeta}
      />
      <div
        className={styles.board}
        data-axis={axis ? "" : undefined}
        data-neg={axis?.neg || undefined}
        data-pos={axis?.pos || undefined}
        style={{ "--zero": axis ? `${axis.zero.toFixed(2)}%` : "50%" } as CSSProperties}
      >
        <div className={styles.head} aria-hidden>
          <span className={styles.headTheme}>{t.themes.boardTheme}</span>
          <span className={styles.headStage}>
            <span className={styles.headTrack}>
              {axis && <span className={cn("numeral", styles.headZero)}>0</span>}
            </span>
          </span>
          <span className={styles.headEnds}>
            {t.themes.breadth}
          </span>
        </div>
        <ol className={styles.rows}>
          {sorted.map((card, index) => {
            const live = inScale(card) && axis !== null;
            const edge = !live ? undefined : card.theme.slug === board.leader ? "lead" : card.theme.slug === board.laggard ? "lag" : undefined;
            const median = live ? card.median! : null;
            const extra = card.members.length - ROW_LOGOS;
            const title = themeTitle(card.theme, locale);
            /* Üyeler en zayıftan en güçlüye (eksenle aynı yön: sol düşüş, sağ
               yükseliş); seansı tutmayan üye sonda, nötr. */
            const ranked = live ? [...card.points].sort((a, b) => a.change - b.change) : [];
            const missing = live ? card.members.length - ranked.length : 0;
            const worst = ranked[0] ?? null;
            const best = ranked.length > 1 ? ranked[ranked.length - 1] : null;
            const logoOf = (symbol: string) => card.members.find((member) => member.symbol === symbol)?.logoUrl ?? null;
            const length = median === null ? 0 : Math.max(Math.abs(median) * axis!.unit, 0.4);
            const figure = (
              <span className={cn("numeral", median === null ? "text-muted" : directionText(directionOf(median)))}>
                {median === null ? NO_VALUE : <RollingFigure value={pct(median)} />}
              </span>
            );
            const end = (tone: "up" | "down", count: number | null, member: { symbol: string; change: number } | null) => (
              <span className={styles.end} data-tone={tone}>
                <span className={styles.endCount}>
                  {tone === "up" ? <ArrowUp weight="bold" size={12} aria-hidden /> : <ArrowDown weight="bold" size={12} aria-hidden />}
                  <b className="numeral">{count ?? NO_VALUE}</b>
                  <span className="sr-only"> {tone === "up" ? t.themes.up : t.themes.down}</span>
                </span>
                {member ? (
                  <span className={styles.endMember}>
                    <LogoTile symbol={member.symbol} logoUrl={logoOf(member.symbol)} size="xs" className={styles.endLogo} />
                    <span className={cn("numeral", styles.endSymbol)}>{member.symbol}</span>
                    <b className={cn("numeral", styles.endPct, directionText(directionOf(member.change)))}>{pct(member.change)}</b>
                  </span>
                ) : (
                  <span className={cn(styles.endMember, "text-muted")}>{NO_VALUE}</span>
                )}
              </span>
            );
            return (
              <li key={card.theme.slug} className={styles.item} data-draw style={{ "--i": index } as CSSProperties}>
                <Link href={`/temalar/${card.theme.slug}`} prefetch={false} className={styles.row} data-edge={edge}>
                  <span className={cn("numeral", styles.pos)} aria-hidden>
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className={styles.id}>
                    <b className={styles.name}>{title}</b>
                    <span className={styles.logos} aria-hidden>
                      {card.members.length === 0
                        ? Array.from({ length: ROW_LOGOS }, (_, i) => <Skeleton key={i} className={styles.logoGhost} />)
                        : card.members.slice(0, extra === 1 ? ROW_LOGOS + 1 : ROW_LOGOS).map((member) => (
                            <LogoTile key={member.symbol} symbol={member.symbol} logoUrl={member.logoUrl} size="md" className={styles.logo} card />
                          ))}
                      {extra > 1 && <span className={cn("numeral", styles.more)}>+{extra}</span>}
                    </span>
                  </span>
                  {/* Telefonda sayı adın yanında (çubuğun ucunda yer yok); geniş
                      ekranda çubuğun ucundaki `tip`. İkisinden biri `display:none`. */}
                  <span className={styles.fig}>{figure}</span>
                  <span
                    className={styles.stage}
                    role="img"
                    aria-label={
                      card.up === null || !live
                        ? t.themes.spreadMissing
                        : t.themes.spreadLabel
                            .replace("{count}", String(card.points.length))
                            .replace("{up}", String(card.up))
                            .replace("{down}", String(card.down))
                    }
                  >
                    <span className={styles.track}>
                      {median === null ? (
                        <i className={styles.lane} />
                      ) : (
                        <>
                          <i
                            className={cn("bar-fill", styles.bar)}
                            data-tone={directionOf(median)}
                            style={
                              median >= 0
                                ? { left: "var(--zero)", width: `${length.toFixed(2)}%` }
                                : { right: "calc(100% - var(--zero))", width: `${length.toFixed(2)}%` }
                            }
                          />
                          <span
                            className={styles.tip}
                            style={
                              median >= 0
                                ? { left: `calc(var(--zero) + ${length.toFixed(2)}% + var(--tip-gap))` }
                                : { right: `calc(100% - var(--zero) + ${length.toFixed(2)}% + var(--tip-gap))` }
                            }
                          >
                            {figure}
                          </span>
                        </>
                      )}
                    </span>
                    {/* LOGOLU ISI KAROLARI (11 Kasım, sahibinin isteği: "o yeşil
                        kırmızı olan yerlere şirketlerin logosunu koysak").
                        Her karo bir üye; zemin yönün kademesi, ortada logosu
                        — hangi şirketin taşıdığı renkten sonra ikinci bakışta
                        okunuyor. Karo daralınca (kap < 480 ya da 26'dan çok
                        üye) logo düşer, renk kalır (`data-dense`, CSS). */}
                    <span className={styles.heat} data-dense={ranked.length > 26 || undefined}>
                      {ranked.length === 0 ? (
                        <i className={styles.heatLane} />
                      ) : (
                        <>
                          {ranked.map((point, k) => {
                            const heat = heatOf(point.change);
                            return (
                              <i
                                key={point.symbol}
                                className={styles.cell}
                                data-tone={heat.tone}
                                data-level={heat.level}
                                data-tip={`${point.symbol} ${pct(point.change)}`}
                                style={{ "--k": Math.round((k / Math.max(ranked.length - 1, 1)) * HEAT_STAGGER) } as CSSProperties}
                              >
                                <LogoTile symbol={point.symbol} logoUrl={logoOf(point.symbol)} size="xs" className={styles.cellLogo} />
                              </i>
                            );
                          })}
                          {Array.from({ length: missing }, (_, k) => (
                            <i key={`m${k}`} className={styles.cell} data-tone="none" style={{ "--k": HEAT_STAGGER } as CSSProperties} />
                          ))}
                        </>
                      )}
                    </span>
                  </span>
                  <span className={styles.ends}>
                    {end("up", live ? card.up : null, best && best.change > 0 ? best : null)}
                    {end("down", live ? card.down : null, worst && worst.change < 0 ? worst : null)}
                  </span>
                  <ArrowUpRight weight="bold" size={16} className={styles.arrow} aria-hidden />
                </Link>
              </li>
            );
          })}
        </ol>
      </div>
      {/* Künye panelin İÇİNDE, hairline ile (ekran düzeni 6): iki çizimin okuması. */}
      <p className={styles.legend}>
        <span><i className={styles.keyBar} aria-hidden />{t.themes.benchMedian}</span>
        <span>
          <i className={styles.keyHeat} aria-hidden><i data-l="-4" /><i data-l="-2" /><i data-l="-1" /><i data-l="1" /><i data-l="2" /><i data-l="4" /></i>
          {t.themes.boardKeyHeat}
        </span>
        <span className={styles.legendNote}>{t.themes.boardNote}</span>
      </p>
    </Panel>
  );
}
