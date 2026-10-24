/**
 * Günün Posteri — mürekkep sahnesi (24 Ekim).
 *
 * Öteki sahneler bir karakteri oynatıyor; bu sahne bir SEANSI çiziyor ve
 * içindeki her iz bir sayı (lib/day-poster.ts, sayfa `/gun/[tarih]`):
 *
 *   - ÜST BANT, NOKTALAR: her nokta bir S&P 500 hissesi. Sütun sütun
 *     diziliyorlar; yükselenler soldan, düşenler sağdan, değişmeyenler
 *     arada. Bandın sol yanının mürekkep yoğunluğu GENİŞLİĞİN kendisi —
 *     312 yükselen 312 nokta, sayılabilir.
 *   - KULVARLAR: on bir sektör fonu, günün en güçlüsünden en zayıfına;
 *     altında boşlukla dört endeks fonu. Kulvar `--line-soft` üstünde
 *     5 piksellik şerit, sıfır çizgisi `--line-strong` (sitenin grafik
 *     dili, CLAUDE.md). Şerit sıfırdan sağa yükselişte, sola düşüşte;
 *     boyu yüzdeyle orantılı ve ölçek bütün kulvarlarda TEK
 *     (`posterScale`, tabanı %1).
 *   - RENK yalnız işaretten: `--up`, `--down`. Büyüklük renkle değil
 *     boyla okunuyor.
 *
 * Süs yok: kıvılcım, imza çizgisi, zil bu sahnede yok — çizilen her şey
 * yanındaki lejantta bir satıra karşılık geliyor.
 *
 * Saf ve tohumlu: aynı gün aynı fırça dokusunu veriyor (`posterSeed`),
 * hareketi azaltana son kare basılıyor (InkCanvas). Sahne bir kez oynuyor:
 * önce kulvarlar ve sıfır çizgisi, sonra noktalar soldan sağa, en son
 * şeritler yukarıdan aşağı — okuma sırası.
 *
 * Bu modül `"use client"` DEĞİL: veriden sahneyi kuran saf bir fonksiyon;
 * istemci bileşeni (`DayPosterCanvas`) onu `useMemo` ile çağırıyor.
 */
import { blot, brush, ease, rng, segment, span, type InkPalette } from "./engine";
import type { InkScene } from "./scenes";

export type PosterSceneData = {
  seed: number;
  /** Kulvarın ucunun karşılığı, yüzde puan. */
  scale: number;
  /** Sektör değişimleri, kulvar sırasında (güçlüden zayıfa). */
  sectors: number[];
  /** Endeks değişimleri, `INDEX_STRIP` sırasında. */
  indices: number[];
  breadth: { advancing: number; unchanged: number; declining: number } | null;
};

/* ---- Ölçüler (tasarım kutusu birimi; InkCanvas kutuyu tuvale sığdırıyor) */
export const POSTER_BOX_W = 360;
const PAD_X = 12;
const ZERO_X = POSTER_BOX_W / 2;
const HALF = ZERO_X - PAD_X;
const TOP = 12;
/** Nokta bandının sütun sayısı; ~500 üye 11 satıra iniyor. */
const DOT_COLS = 46;
const DOT_PITCH_Y = 6.2;
const DOT_R = 2.15;
const BAND_GAP = 20;
const LANE_PITCH = 14;
const LANE_WIDTH = 5;
const GROUP_GAP = 12;
const BOTTOM = 12;

function dotRows(total: number) {
  return Math.max(1, Math.ceil(total / DOT_COLS));
}

/** Kutunun yüksekliği veriden: genişlik yoksa bant hiç yer almıyor. */
export function posterBoxHeight(data: Pick<PosterSceneData, "sectors" | "indices" | "breadth">): number {
  const total = data.breadth ? data.breadth.advancing + data.breadth.unchanged + data.breadth.declining : 0;
  const band = data.breadth ? dotRows(total) * DOT_PITCH_Y + BAND_GAP : 0;
  const lanes = (data.sectors.length + data.indices.length) * LANE_PITCH + (data.indices.length ? GROUP_GAP : 0);
  return Math.round(TOP + band + lanes + BOTTOM);
}

/* ---- Zamanlama (sn) */
const TRACK_AT = 0;
const TRACK_STEP = 0.025;
const TRACK_DUR = 0.45;
const DOTS_AT = 0.25;
const DOT_COL_STEP = 0.022;
const DOT_DUR = 0.22;
const BARS_AT = 0.95;
const BAR_STEP = 0.07;
const BAR_DUR = 0.45;

export function posterScene(data: PosterSceneData): InkScene {
  const h = posterBoxHeight(data);
  const lanes = [...data.sectors, ...data.indices];
  const end = BARS_AT + Math.max(0, lanes.length - 1) * BAR_STEP + BAR_DUR + 0.1;
  const total = data.breadth ? data.breadth.advancing + data.breadth.unchanged + data.breadth.declining : 0;
  const rows = dotRows(total);
  const bandH = data.breadth ? rows * DOT_PITCH_Y + BAND_GAP : 0;
  const laneY = (i: number) =>
    TOP + bandH + i * LANE_PITCH + (i >= data.sectors.length ? GROUP_GAP : 0) + LANE_PITCH / 2;

  return {
    box: { w: POSTER_BOX_W, h },
    end,
    render(ctx, t, pal: InkPalette) {
      const up = pal.up ?? pal.ink;
      const down = pal.down ?? pal.ink;
      const lane = pal.lane ?? pal.ink;
      const rule = pal.rule ?? pal.ink;

      /* 1. Kulvarlar: soldan sağa açılan soluk izler. */
      lanes.forEach((_, i) => {
        const y = laneY(i);
        brush(ctx, segment({ x: PAD_X, y }, { x: POSTER_BOX_W - PAD_X, y }, 24), {
          width: LANE_WIDTH,
          progress: ease.inOut(span(t, TRACK_AT + i * TRACK_STEP, TRACK_AT + i * TRACK_STEP + TRACK_DUR)),
          seed: data.seed + 200 + i,
          taper: 0,
          wobble: 0.05,
          color: lane,
        });
      });

      /* 2. Sıfır çizgisi: kulvarların başından sonuna, yukarıdan aşağı. */
      if (lanes.length) {
        const y0 = laneY(0) - LANE_PITCH / 2;
        const y1 = laneY(lanes.length - 1) + LANE_PITCH / 2;
        brush(ctx, segment({ x: ZERO_X, y: y0 }, { x: ZERO_X, y: y1 }, 24), {
          width: 1.4,
          progress: ease.inOut(span(t, 0.2, 0.75)),
          seed: data.seed + 300,
          taper: 0.2,
          wobble: 0.1,
          color: rule,
        });
      }

      /* 3. Genişlik: her hisse bir nokta, sütun sütun soldan sağa. */
      if (data.breadth) {
        const { advancing, unchanged } = data.breadth;
        const pitchX = (POSTER_BOX_W - PAD_X * 2) / DOT_COLS;
        const jitter = rng(data.seed + 400);
        for (let k = 0; k < total; k++) {
          const col = Math.floor(k / rows);
          const row = k % rows;
          /* Titreme tohumdan ve küçük (±0,5): el izi, ama sıra bozulmuyor. */
          const jx = (jitter() - 0.5) * 1;
          const jy = (jitter() - 0.5) * 1;
          const at = DOTS_AT + col * DOT_COL_STEP;
          const grow = span(t, at, at + DOT_DUR);
          if (grow <= 0) continue;
          const tone = k < advancing ? up : k < advancing + unchanged ? pal.ink : down;
          blot(ctx, PAD_X + pitchX * (col + 0.5) + jx, TOP + DOT_PITCH_Y * (row + 0.5) + jy, DOT_R, {
            seed: data.seed + k,
            spread: ease.back(grow),
            color: tone,
            alpha: k >= advancing && k < advancing + unchanged ? 0.35 : 0.9,
          });
        }
      }

      /* 4. Şeritler: sıfırdan dışa, kulvar sırasıyla. */
      lanes.forEach((change, i) => {
        const length = (Math.min(Math.abs(change), data.scale) / data.scale) * HALF;
        if (length < 0.5) return;
        const y = laneY(i);
        const dir = change >= 0 ? 1 : -1;
        const at = BARS_AT + i * BAR_STEP;
        brush(ctx, segment({ x: ZERO_X, y }, { x: ZERO_X + dir * length, y }, Math.max(4, Math.round(length / 6))), {
          width: LANE_WIDTH,
          progress: ease.out(span(t, at, at + BAR_DUR)),
          seed: data.seed + 500 + i,
          /* Sıfır tarafı düz, uç hafif sivri: boy okunurken uç fırça gibi. */
          taper: 0.35,
          taperStart: 0,
          wobble: 0.08,
          color: change >= 0 ? up : down,
        });
      });
    },
  };
}
