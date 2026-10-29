"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Crown, PencilSimple, Timer } from "@phosphor-icons/react/dist/ssr";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { Button, Panel, PanelHeader } from "@/components/ui/primitives";
import type { BoardResponse } from "@/app/api/bulmaca/siralama/route";
import type { StockPuzzleLabels } from "@/lib/i18n/dictionaries/stock-puzzle";
import { MAX_GUESSES } from "@/lib/stock-puzzle";
import { NICKNAME_MAX, formatDuration, type BoardRow } from "@/lib/puzzle-board";
import { cn } from "@/lib/utils";
import { fill } from "./puzzle-format";
import { PUZZLE_UPDATE_EVENT } from "./puzzle-event";
import styles from "./PuzzleLeaderboard.module.css";

/**
 * GÜNÜN SIRALAMASI (29 Ekim, sahibinin isteği: "leaderboard da koyalım,
 * bu sürede bildi, bu kadar ilerledi gibi"). Kurallar `lib/puzzle-board.ts`.
 *
 * Tahtanın altında, "Nasıl Oynanır"ın üstünde — oynarken bakılan şey değil,
 * oyun bitince bakılan şey. Satır: sıra (ilk üç taç), ad, altı yuvada
 * kaçıncı tahminde bildiği, süre. Okurun satırı vurgulu; ilk yirmide
 * değilse tablonun altında ayrıca. Oyun sürüyorsa "bu kadar ilerledi":
 * kaç tahmin kullandığı.
 *
 * İstemciden istenir: sayfanın HTML'i başka okurların verisini taşımaz,
 * panel kendi yerini ayırır (iskelet) ve tablo yoksa (migration yok)
 * HİÇ basılmaz. Tahmin işlenince tahta olay yayar (`PUZZLE_UPDATE_EVENT`),
 * tablo tazelenir. Giriş yapmış okur sayfayı açınca saati başlar
 * (`action: "start"`).
 *
 * Takma ad isteğe bağlı; vermeyen anonim ("Oyuncu 3F2A"). Hesap adı ya da
 * e-posta hiçbir zaman basılmaz.
 */
type Loaded = Extract<BoardResponse, { ok: true }>;

async function request(init?: RequestInit): Promise<Loaded | null> {
  try {
    const response = await fetch("/api/bulmaca/siralama", { cache: "no-store", ...init });
    const data = (await response.json()) as BoardResponse;
    return data.ok ? data : null;
  } catch {
    return null;
  }
}

export function PuzzleLeaderboard({ labels }: { labels: StockPuzzleLabels }) {
  const B = labels.board;
  const [data, setData] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const started = useRef(false);
  const units = { h: B.unitH, m: B.unitM, s: B.unitS };

  const refresh = useCallback(async () => {
    const next = await request();
    if (next) setData(next);
    else setFailed(true);
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const first = await request();
      if (!alive) return;
      if (!first) {
        setFailed(true);
        return;
      }
      setData(first);
      /* Saat okurun bugünkü bulmacayı ilk açtığı an başlar (kayıt varsa dokunulmaz). */
      if (first.signedIn && first.board.available && !started.current) {
        started.current = true;
        const after = await request({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "start" }) });
        if (alive && after) setData(after);
      }
    })();
    const onUpdate = () => void refresh();
    window.addEventListener(PUZZLE_UPDATE_EVENT, onUpdate);
    return () => {
      alive = false;
      window.removeEventListener(PUZZLE_UPDATE_EVENT, onUpdate);
    };
  }, [refresh]);

  if (failed && !data) return null;
  if (data && !data.board.available) return null;

  const board = data?.board;
  const you = board?.you ?? null;
  const youInTop = Boolean(board?.rows.some((row) => row.you));

  const saveName = async () => {
    setSaving(true);
    setNameError(null);
    const next = await request({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "nickname", nickname: draft }) });
    setSaving(false);
    if (!next) {
      setNameError(B.nicknameInvalid);
      return;
    }
    setData(next);
    setEditing(false);
  };

  return (
    <Panel aria-busy={!data}>
      <PanelHeader
        title={B.title}
        meta={board ? <span className="numeral">{fill(B.meta, { solved: board.solved, players: board.players })}</span> : undefined}
      />
      <div className={styles.body}>
        {!board ? (
          <div aria-hidden className={styles.skeleton} />
        ) : board.rows.length === 0 ? (
          <p className={styles.empty}>{B.empty}</p>
        ) : (
          <ol className={styles.rows}>
            {board.rows.map((row, index) => (
              <Row key={`${row.name}-${row.finishedAt}`} row={row} rank={index + 1} labels={labels} units={units} />
            ))}
          </ol>
        )}

        {/* Okurun kendi durumu: tabloda değilse sırası; sürüyorsa ilerlemesi. */}
        {board && you && !youInTop && you.row && you.rank !== null && (
          <ol className={cn(styles.rows, styles.mine)} start={you.rank}>
            <Row row={you.row} rank={you.rank} labels={labels} units={units} />
          </ol>
        )}
        {board && you && you.status === "playing" && (
          <p className={styles.progress}>
            <Timer aria-hidden size={14} weight="bold" />
            {you.guesses > 0 ? fill(B.youPlaying, { n: you.guesses, total: MAX_GUESSES }) : B.youStarted}
          </p>
        )}
        {board && you && you.status === "lost" && <p className={styles.progress}>{B.youLost}</p>}

        {/* Giriş ve takma ad — panelin içinde, kıl çizgiyle ayrılmış düz satır. */}
        {data && !data.signedIn && (
          <p className={styles.note}>
            {B.signInNote}{" "}
            <Link href="/giris" className={styles.link}>{B.signIn}</Link>
          </p>
        )}
        {data?.signedIn && you && (
          <div className={styles.note}>
            {editing ? (
              <form
                className={styles.nameForm}
                onSubmit={(event) => {
                  event.preventDefault();
                  void saveName();
                }}
              >
                <label htmlFor="bulmaca-takma-ad" className="sr-only">{B.nicknameLabel}</label>
                <input
                  id="bulmaca-takma-ad"
                  value={draft}
                  maxLength={NICKNAME_MAX}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={B.nicknamePlaceholder}
                  className={styles.input}
                  autoComplete="off"
                />
                <Button type="submit" size="sm" disabled={saving}>{B.save}</Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>{B.cancel}</Button>
                {nameError && <span role="alert" className={styles.nameError}>{nameError}</span>}
                <span className={styles.nameHint}>{B.nicknameHint}</span>
              </form>
            ) : (
              <span className={styles.nameLine}>
                {fill(B.shownAs, { name: you.name })}
                <button
                  type="button"
                  className={styles.link}
                  onClick={() => {
                    setDraft(you.nickname ?? "");
                    setEditing(true);
                  }}
                >
                  <PencilSimple aria-hidden size={13} weight="bold" />
                  {you.nickname ? B.rename : B.pickName}
                </button>
              </span>
            )}
          </div>
        )}
      </div>
    </Panel>
  );
}

function Row({ row, rank, labels, units }: { row: BoardRow; rank: number; labels: StockPuzzleLabels; units: { h: string; m: string; s: string } }) {
  const B = labels.board;
  return (
    <li className={cn(styles.row, row.you && styles.you)} data-rank={rank <= 3 ? rank : undefined}>
      <span className={cn(styles.rank, "numeral")}>
        {rank <= 3 ? <Crown aria-hidden size={14} weight="fill" /> : null}
        {rank}
      </span>
      <span className={styles.name}>
        {row.name}
        {row.you && <span className={styles.youTag}>{B.you}</span>}
      </span>
      <span className={styles.slots} role="img" aria-label={fill(B.guessesLabel, { n: row.guesses })}>
        {Array.from({ length: MAX_GUESSES }, (_, i) => (
          <span key={i} className={styles.slot} data-kind={i < row.guesses - 1 ? "miss" : i === row.guesses - 1 ? "hit" : "empty"} />
        ))}
      </span>
      <span className={cn(styles.time, "numeral")} title={B.timeTitle}>{formatDuration(row.seconds, units)}</span>
    </li>
  );
}
