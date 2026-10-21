"use client";

import { useEffect, useId, useState, type CSSProperties } from "react";
import styles from "./MoveFilm.module.css";

/**
 * "BU HAFTA NEDEN HAREKET ETTİ" BEKLEME FİLMİ — KISA FİLM (18 Ekim,
 * sahibinin isteği: "kısa film gibi olsun, bir konu ve hikâye akışı olsun").
 *
 * Not ilk kez yazılırken Claude 10–20 saniye sürüyor. O süre bir dedektif
 * hikâyesi: büyüteç karakter hissenin haftasını "dosya" olarak açar.
 *   1. Dosya: NVDA — klaket çarpar, uyuklayan dedektif sıçrayarak uyanır.
 *   2. Bir Hafta, Beş Seans — kamera sağa kayar, dedektif sekerek grafiğe
 *      gelir; barlar büyürken gözleri bardan bara gider.
 *   3. Dedektif İz Sürüyor — kamera yaklaşır, iki küçük adım, eğilir;
 *      mercekte parıltı, bar pirinçle çizilir, başının üstünde "!", şapka uçar.
 *   4. Tanıklar Konuşuyor — panoya üç kart sallanarak düşer; dedektif tek tek
 *      bakar, biri eşleşir (onay), ötekiler soluklaşır, başını sallar.
 *   5. İpler Bağlanıyor — kamera geri çekilir; bardan karta ip sarkarak
 *      çekilir, gerilince iğneler sallanır, dedektif sevinçle bir kez seker.
 *   6. Claude Raporu Yazıyor — kamera masaya kayar: defterin sayfası çevrilir,
 *      eşleşen kart panodan uçup sol sayfaya ataşlanır, kalem satırları yazar.
 *      Not gelene kadar yalnız küçük öğeler döner: kahve buharı, kalemin
 *      tıkırtısı, göz kırpma, ter damlası.
 *
 * TEK DÜNYA, KAMERA (21 Ekim, sahibinin isteği: "kısa film animasyonu gibi,
 * tatlı detaylar"). Önceki sürüm her sahnede SVG'yi `key` ile yeniden kurup
 * soluklaşarak kesiyordu; karakter pozdan poza ışınlanıyordu. Artık bütün
 * nesneler tek SVG dünyasında yaşar (klaket 104–216, grafik 380–566, pano
 * 648–792, masa 804+). Sahne değişince yalnız iki şey değişir: kameranın
 * dönüşümü (`SHOTS[].cam`, CSS geçişi, `--ease-move` — kamera eğrisi) ve
 * dedektifin dünyadaki yeri (`SHOTS[].at`). Nesneler kaybolmaz, kadrajdan
 * çıkar; eşleşen kart deftere kadar taşınır. Kamera hareketleri: kayma,
 * itiş, kayarak açılma, geri çekilme, masaya kayma — art arda ikisi aynı değil.
 *
 * YÜRÜYÜŞ ZIPLAYARAK: her zıplama hazırlık ezilmesi → uzayarak kalkış →
 * iniş ezilmesi (`mf-hop`), gölge tepede küçülür, şapka geriden gelir,
 * inişte iki toz bulutu. Yatay yol kameranın eğrisiyle (`--ease-move`):
 * önce sabit hız (`linear`) denendi, kamera yavaş kalkarken karakter
 * kadrajdan çıkıyordu (21 Ekim, 2,9–3,1. sn kareleri boş). Dikeyde kalkış
 * ease-out, düşüş ease-in. Karakterin iç ağacı
 * `key={scene}` ile yeniden kurulur ki o sahnenin oyunu baştan oynasın;
 * dünyadaki yeri kurulmaz, geçişle gider.
 *
 * Hikâye notun gerçekten yaptığı işin sırası: seans barları → haberler →
 * eşleştirme → metin. Sahneler BİR KEZ oynar, son sahne not gelene kadar
 * bekler (CLAUDE.md "sahne dönmez"). Sahne süresi başlığın okuma süresinden
 * kısa olamaz: harf ÷ 15 + 1,5 sn + başlığın 0,45 sn'lik girişi (motion-film
 * `sayilar.md`); 2,4 sn sabit süre 17 harflik başlıkları okutmuyordu.
 * Hareketi azaltana her sahnenin son karesi: geçişler ve keyframe'ler düşer,
 * kamera ve karakter doğrudan son yerinde durur.
 *
 * Çubuklar örnek, veri değil: yön rengi taşır, hiçbir sayı yazmaz. Renk
 * temadan (mürekkep, pirinç, yön); mavi yok, ışıma/bulanıklık yok. Her
 * öğenin TEMEL konumu animasyonun bittiği kare, keyframe yalnız `from`
 * (ya da ara kareler) — hareket kapanınca sahne doğru durur.
 */

/* Sahnenin oyunu bu kadar sürer; okuma süresi daha uzunsa o kazanır. */
const ACT_MS = [2400, 2900, 2900, 3100, 2900];
const readMs = (title: string) => Math.ceil((title.replace(/\s/g, "").length / 15 + 1.5) * 1000 + 450);

/* Kamera: dünya noktası (x, y) kadrajın ortasına, ölçek z; `camMs` o sahneye
   geçişin süresi. `at` dedektifin ayak noktası, `hops` oraya kaç sekişte
   gittiği, `travel` yolun süresi. */
const SHOTS = [
  { cam: [160, 86, 1.1], camMs: 0, at: [252, 146], hops: 0, travel: 0 },
  { cam: [480, 92, 1], camMs: 1150, at: [592, 146], hops: 3, travel: 1100 },
  { cam: [534, 98, 1.4], camMs: 1100, at: [574, 146], hops: 2, travel: 640 },
  { cam: [642, 88, 1], camMs: 1000, at: [626, 146], hops: 2, travel: 700 },
  { cam: [616, 84, 0.88], camMs: 1000, at: [612, 146], hops: 1, travel: 420 },
  { cam: [940, 96, 1.08], camMs: 1250, at: [1034, 146], hops: 4, travel: 1300 },
] as const;
const shotOf = (scene: number) => SHOTS[Math.min(scene, SHOTS.length - 1)];

const BARS = [18, -12, 22, 52, -10];
const HERO = 3;
const ZERO = 104;
const barX = (i: number) => 400 + i * 36;
const CARDS = [18, 60, 102];
const MATCH = 1;
/* Eşleşen kart defterin sol sayfasına yarı boyda iner: (660, 60) → (818, 92). */
const CARD_HOME = "translate(0px, 0px) scale(1)";
const CARD_FILED = "translate(488px, 62px) scale(0.5)";
const LINES = [52, 44, 58, 36, 48];

export function MoveFilm({ scenes, sceneLabel, symbol }: { scenes: readonly string[]; sceneLabel: string; symbol: string }) {
  const [scene, setScene] = useState(0);
  const total = scenes.length;
  const titleOf = (i: number) => (scenes[i] ?? "").replace("{symbol}", symbol);
  const durations = scenes.map((_, i) => Math.max(ACT_MS[i] ?? 0, readMs(titleOf(i))));
  const durationKey = durations.join(",");

  useEffect(() => {
    let at = 0;
    const timers = durationKey
      .split(",")
      .slice(0, -1)
      .map((d, i) => {
        at += Number(d);
        return window.setTimeout(() => setScene(i + 1), at);
      });
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [durationKey]);

  /* Degradeler CSS'ten `var(--mf-tile)` gibi okunur (kökte url'e bağlanır):
     her parçaya kimlik taşımaya gerek kalmaz, sayfada iki film olsa da çakışmaz. */
  const uid = "mf" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const paint = {
    "--count": total,
    "--mf-tile": `url(#${uid}tile)`,
    "--mf-tile-u": `url(#${uid}tileU)`,
    "--mf-sheen": `url(#${uid}sheen)`,
    "--mf-ink": `url(#${uid}ink)`,
  } as CSSProperties;
  const [cx, cy, z] = shotOf(scene).cam;
  const camera: CSSProperties = {
    transform: `translate(160px, 80px) scale(${z}) translate(${-cx}px, ${-cy}px)`,
    transition: `transform ${shotOf(scene).camMs}ms var(--ease-move)`,
  };

  /* FİLM EKRAN OKUYUCUDAN GİZLİ (20 Ekim). Altyazı `aria-live` taşıyordu ve
     her 2,4 saniyede bir sahne adı okunuyordu ("2/6 Bir Hafta, Beş
     Seans"…): süs olan bir hikâye, okuyucunun sayfada okuduğu şeyi beş kez
     bölüyordu. Filmin yerinde kart düz bir sr-only "yükleniyor" satırı
     taşıyor; tarama kipinde okunur, bilerek duyurulmaz (StockInsightCard). */
  return (
    <div className={styles.film} data-scene={scene} style={paint} aria-hidden>
      <div className={styles.screen}>
        <span className={styles.perf} aria-hidden />
        <svg viewBox="0 0 320 160" className={styles.stage} aria-hidden>
          <defs>
            {/* Marka karosu (150°, açık gökten gece mavisine) + üst parlaklık. */}
            <linearGradient id={`${uid}tile`} x1="0" y1="0" x2="0.62" y2="1">
              <TileStops />
            </linearGradient>
            {/* Aynı karo, karakterin yerel uzayında: yatay/dikey çizgide kutu degradesi çökmesin. */}
            <linearGradient id={`${uid}tileU`} gradientUnits="userSpaceOnUse" x1="-12" y1="-40" x2="18" y2="-4">
              <TileStops />
            </linearGradient>
            <linearGradient id={`${uid}sheen`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" className={styles.sheenTop} />
              <stop offset="0.55" className={styles.sheenEnd} />
            </linearGradient>
            {/* Manşet mürekkebi (`--display-gradient`): klaketteki sembol. */}
            <linearGradient id={`${uid}ink`} x1="0" y1="0" x2="1" y2="0.25">
              <stop offset="0" className={styles.ink1} />
              <stop offset="0.5" className={styles.ink2} />
              <stop offset="1" className={styles.ink3} />
            </linearGradient>
          </defs>
          <g className={styles.camera} style={camera}>
            <Slate symbol={symbol} />
            <Week />
            {/* Masa panodan önce çizilir: deftere uçan kart sayfanın üstünde kalsın. */}
            <Desk symbol={symbol} />
            <Board filed={scene >= 5} />
            <Detective scene={scene} />
          </g>
        </svg>
        <span className={styles.perf} data-bottom aria-hidden />
      </div>
      <div className={styles.caption}>
        <span className={styles.counter}>{sceneLabel.replace("{n}", String(scene + 1)).replace("{total}", String(total))}</span>
        <span key={scene} className={styles.title}>{titleOf(scene)}</span>
      </div>
      <div className={styles.progress} aria-hidden>
        {scenes.map((_, i) => (
          <span key={i} className={styles.segment} data-state={i < scene ? "done" : i === scene ? "now" : "next"} style={{ "--ms": `${durations[i]}ms` } as CSSProperties} />
        ))}
      </div>
    </div>
  );
}

function TileStops() {
  return (
    <>
      <stop offset="0" className={styles.tile1} />
      <stop offset="0.48" className={styles.tile2} />
      <stop offset="1" className={styles.tile3} />
    </>
  );
}

/* ---- Karakter: büyüteç dedektif. Yerel koordinat: (0, 0) ayak noktası,
   mercek (0, −24) merkezli, şapka tepesi −46. ---- */
function Detective({ scene }: { scene: number }) {
  const lensId = useId();
  const shot = shotOf(scene);
  const hop = shot.hops ? shot.travel / shot.hops : 0;
  /* Hazırlık ezilmesi bitmeden yola çıkmaz, son inişte ayak yere değince durur. */
  const lead = Math.round(hop * 0.14);
  const place: CSSProperties = {
    translate: `${shot.at[0]}px ${shot.at[1]}px`,
    transition: shot.hops ? `translate ${shot.travel - lead * 2}ms var(--ease-move) ${lead}ms` : "none",
  };
  const travel = shot.hops ? ({ "--hop": `${Math.round(hop)}ms`, "--hops": shot.hops, "--land": `${shot.travel - lead}ms` } as CSSProperties) : undefined;
  return (
    <g style={place}>
      <g key={scene} data-travel={shot.hops ? "" : undefined} style={travel}>
        <ellipse className={styles.shadow} cx="0" cy="0.5" rx="13" ry="2.6" />
        <g className={styles.dust}>
          <circle cx="-14" cy="-2.5" r="3" />
          <circle cx="15" cy="-2" r="2.4" />
        </g>
        <g className={styles.hop}>
          <g className={styles.pose}>
            <line x1="-4.5" y1="-11" x2="-5.5" y2="-2" className={styles.leg} />
            <line x1="4.5" y1="-11" x2="5.5" y2="-2" className={styles.leg} />
            <ellipse cx="-7" cy="-1.8" rx="3.8" ry="1.9" className={styles.foot} />
            <ellipse cx="7" cy="-1.8" rx="3.8" ry="1.9" className={styles.foot} />
            <line x1="9.5" y1="-14.5" x2="18" y2="-6" className={styles.handle} />
            <circle cy="-24" r="13" className={styles.lens} />
            <path d="M -11.6 -29.9 A 13 13 0 0 1 -5.9 -35.6" className={styles.rimSheen} />
            <clipPath id={lensId}>
              <circle cy="-24" r="11.5" />
            </clipPath>
            <g clipPath={`url(#${lensId})`}>
              <g className={styles.glint}>
                <path d="M -5 -18 L 5 -30" />
                <path d="M 0 -16 L 7 -24.5" data-thin />
              </g>
            </g>
            <g className={styles.nod}>
              <g className={styles.face}>
                <circle cx="-8" cy="-19.5" r="2.2" className={styles.cheek} />
                <circle cx="8" cy="-19.5" r="2.2" className={styles.cheek} />
                <g className={styles.eyes}>
                  <ellipse cx="-4.5" cy="-25" rx="1.9" ry="2.6" />
                  <ellipse cx="4.5" cy="-25" rx="1.9" ry="2.6" />
                </g>
                <path d="M -6.5 -25 q 2 1.6 4 0 M 2.5 -25 q 2 1.6 4 0" className={styles.sleep} />
                <path d="M -3.5 -18.5 Q 0 -15.8 3.5 -18.5" className={styles.smile} />
                <ellipse cx="0" cy="-17.5" rx="1.6" ry="2" className={styles.gasp} />
              </g>
              <g className={styles.hat}>
                <g className={styles.hatPop}>
                  <rect x="-12.5" y="-38.6" width="25" height="3.2" rx="1.6" />
                  <path d="M -8 -37.5 L -7 -45 Q 0 -47.5 7 -45 L 8 -37.5 Z" />
                  <line x1="-7.6" x2="7.6" y1="-39.6" y2="-39.6" className={styles.band} />
                </g>
              </g>
            </g>
            <g className={styles.bang}>
              <circle cx="14" cy="-55" r="7" />
              <line x1="14" x2="14" y1="-59" y2="-54.5" className={styles.bangMark} />
              <circle cx="14" cy="-51.6" r="1.1" className={styles.bangPoint} />
            </g>
            <path d="M 15.5 -40 q 2.6 3.4 0 5.2 q -2.6 -1.8 0 -5.2 z" className={styles.sweat} />
          </g>
        </g>
      </g>
    </g>
  );
}

/* 1 · Klaket: dosyanın açılışı (dünya 104–216). */
function Slate({ symbol }: { symbol: string }) {
  return (
    <g className={styles.slate}>
      <rect x="104" y="62" width="112" height="72" rx="8" className={styles.boardBody} />
      <text x="160" y="108" textAnchor="middle" className={styles.boardText}>
        {symbol}
      </text>
      <g className={styles.clapper}>
        <rect x="104" y="44" width="112" height="16" rx="4" className={styles.clapArm} />
        {[0, 1, 2, 3].map((i) => (
          <path key={i} d={`M ${116 + i * 26} 44 l 12 0 l -8 16 l -12 0 z`} className={styles.stripe} />
        ))}
        <rect x="104" y="44" width="112" height="16" rx="4" className={styles.sheen} />
      </g>
    </g>
  );
}

/* 2–3 · Hafta (dünya 380–566): beş seans, kahraman bar pirinçle çizilir. */
function Week() {
  const h = BARS[HERO];
  return (
    <g>
      <line x1="380" x2="566" y1={ZERO} y2={ZERO} className={styles.zero} />
      {BARS.map((v, i) => (
        <rect
          key={i}
          className={styles.bar}
          data-dir={v > 0 ? "up" : "down"}
          x={barX(i) - 9}
          y={v > 0 ? ZERO - v : ZERO}
          width={18}
          height={Math.abs(v)}
          rx={3}
          style={{ "--d": `${1000 + i * 200}ms` } as CSSProperties}
        />
      ))}
      <rect className={styles.heroRing} x={barX(HERO) - 13} y={ZERO - h - 4} width={26} height={h + 4} rx={6} pathLength={100} />
    </g>
  );
}

/* 4–5 · Pano (dünya 648–792): tanık kartları, eşleşen kart, ip. */
function Board({ filed }: { filed: boolean }) {
  const heroTop = { x: barX(HERO), y: ZERO - BARS[HERO] - 4 };
  const knot = { x: 662, y: CARDS[MATCH] + 15 };
  const mid = (heroTop.x + knot.x) / 2;
  return (
    <g>
      <rect x="648" y="8" width="144" height="136" rx="10" className={styles.cork} />
      <g className={styles.threads}>
        <path className={styles.thread} pathLength={100} d={`M ${heroTop.x} ${heroTop.y} Q ${mid} ${heroTop.y + 8} ${knot.x} ${knot.y}`} />
        <g className={styles.threadPin}>
          <Pin x={heroTop.x} y={heroTop.y} />
        </g>
      </g>
      {CARDS.map((y, i) => (
        <g key={y} className={styles.cardMove} data-match={i === MATCH || undefined} style={{ transform: i === MATCH && filed ? CARD_FILED : CARD_HOME }}>
          <g className={styles.cardDrop} style={{ transformOrigin: `720px ${y}px`, rotate: `${[-2.5, 0, 2][i]}deg`, "--d": `${500 + i * 250}ms` } as CSSProperties}>
            <rect x="660" y={y} width="120" height="30" rx="6" className={styles.card} />
            <rect x="670" y={y + 9} width="70" height="5" rx="2.5" className={styles.ink} />
            <rect x="670" y={y + 19} width="46" height="4" rx="2" className={styles.inkSoft} />
            <Pin x={720} y={y + 1} />
            {i === MATCH && (
              <>
                <g className={styles.check}>
                  <circle cx="776" cy={y + 2} r="8" className={styles.checkDot} />
                  <path d={`M 772 ${y + 2} l 2.8 2.8 l 5 -5.4`} className={styles.checkMark} />
                </g>
                <g className={styles.threadPin} data-late>
                  <Pin x={knot.x} y={knot.y} />
                </g>
                <path d={`M 668 ${y + 12} v -14 a 4 4 0 0 1 8 0 v 18 a 2.4 2.4 0 0 1 -4.8 0 v -14`} className={styles.clip} />
              </>
            )}
          </g>
        </g>
      ))}
    </g>
  );
}

/* Raptiye: baş + iğne; ip gerilince ucunun etrafında sallanır. */
function Pin({ x, y }: { x: number; y: number }) {
  return (
    <g className={styles.pin} style={{ transformOrigin: `${x}px ${y}px` }}>
      <line x1={x} y1={y} x2={x - 1.5} y2={y - 4} className={styles.needle} />
      <circle cx={x - 2} cy={y - 5} r="3.2" className={styles.pinHead} />
    </g>
  );
}

/* 6 · Masa (dünya 804+): defter, kalem, kahve. */
function Desk({ symbol }: { symbol: string }) {
  const sketch = BARS.map((v, i) => ({ x: 828 + i * 9, v: v * 0.3 }));
  return (
    <g className={styles.desk}>
      <line x1="804" x2="1080" y1="146.5" y2="146.5" className={styles.deskTop} />
      <line x1="822" x2="822" y1="147" y2="190" className={styles.deskLeg} />
      <line x1="1062" x2="1062" y1="147" y2="190" className={styles.deskLeg} />
      {/* Defter: kapak, iki sayfa. Sol sayfada dosyanın künyesi ve haftanın karalaması. */}
      <rect x="808" y="60" width="152" height="84" rx="5" className={styles.cover} />
      <rect x="808" y="60" width="152" height="84" rx="5" className={styles.sheen} />
      <rect x="812" y="64" width="70" height="78" rx="3" className={styles.page} />
      <rect x="886" y="64" width="70" height="78" rx="3" className={styles.page} />
      <g className={styles.leftPage}>
        <text x="820" y="80" className={styles.pageText}>
          {symbol}
        </text>
        <line x1="822" x2="874" y1="128" y2="128" className={styles.sketchZero} />
        {sketch.map((b) => (
          <line key={b.x} x1={b.x} x2={b.x} y1={128} y2={128 - b.v} className={styles.sketchBar} />
        ))}
      </g>
      {LINES.map((w, i) => (
        <rect key={i} x="894" y={76 + i * 12} width={w} height="3.6" rx="1.8" className={styles.typed} style={{ "--d": `${2100 + i * 560}ms` } as CSSProperties} />
      ))}
      {/* Çevrilen sayfa: eski notların karalaması; omurgada (884) döner. */}
      <g className={styles.flip}>
        <rect x="886" y="64" width="70" height="78" rx="3" className={styles.page} />
        {[40, 52, 30].map((w, i) => (
          <rect key={i} x="894" y={78 + i * 12} width={w} height="3" rx="1.5" className={styles.inkSoft} />
        ))}
      </g>
      <g className={styles.pen}>
        <g className={styles.penTap}>
          <g transform="rotate(-50)">
            <rect x="3" y="-1.9" width="20" height="3.8" rx="1.4" className={styles.penBody} />
            <path d="M 0 0 L 3.4 -1.9 L 3.4 1.9 Z" className={styles.penNib} />
          </g>
        </g>
      </g>
      {/* Kahve: fincan ve iki buhar kıvrımı. */}
      <path d="M 975 127 h 22 v 10 a 8 8 0 0 1 -8 8 h -6 a 8 8 0 0 1 -8 -8 z" className={styles.cup} />
      <path d="M 997 130 a 4.5 4.5 0 0 1 0 9" className={styles.cupHandle} />
      <path d="M 982 122 c -3 -3 3 -5 0 -9 c -3 -3 3 -5 0 -8" className={styles.steam} />
      <path d="M 990 122 c -3 -3 3 -5 0 -9 c -3 -3 3 -5 0 -8" className={styles.steam} data-late />
    </g>
  );
}
