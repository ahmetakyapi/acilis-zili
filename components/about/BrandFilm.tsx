import { Panel, PanelHeader } from "@/components/ui/primitives";
import type { Dictionary } from "@/lib/i18n";
import styles from "./About.module.css";

/** The film and its poster, compressed for the web (720x1280, H.264, faststart). */
const FILM_SRC = "/film/zil-caliyor.mp4";
const FILM_POSTER = "/film/zil-caliyor-poster.jpg";

/**
 * Tanıtım Filmi — the "Zil Çalıyor" promo on the About page.
 *
 * NEVER PLAYS BY ITSELF (docs/film-kimligi.md §7): no autoplay, no sound until
 * the reader presses play, `preload="none"` so the 1.2 MB file is fetched only
 * then. That also covers reduced motion: the still poster is the film's frame
 * for anyone who does not press play.
 *
 * The film names one season ("Kış Saatiyle 17:30"); the note under it gives
 * today's opening from the session clock, so the page is right in summer too
 * (`openIstanbul`, computed by the page from `timePair`).
 *
 * Credits sit inside the panel under a hairline, as plain lines (CLAUDE.md
 * screen order §6); CC BY asks for title, maker, licence, source and changes.
 */
export function BrandFilm({ t, openIstanbul }: { t: Dictionary; openIstanbul: string }) {
  const f = t.brandFilm;
  return (
    <Panel id="film">
      <PanelHeader title={f.title} />
      <div className={styles.film}>
        <video
          className={styles.filmVideo}
          controls
          playsInline
          preload="none"
          poster={FILM_POSTER}
          width={720}
          height={1280}
          aria-label={f.videoLabel}
        >
          <source src={FILM_SRC} type="video/mp4" />
        </video>
        <div className={styles.filmCopy}>
          {f.body.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          <p className={styles.filmNote}>
            {f.seasonNote.replace("{open}", openIstanbul)}
            {f.languageNote && ` ${f.languageNote}`}
          </p>
          <div className={styles.filmCredits}>
            <h3>{f.creditsTitle}</h3>
            <ul>
              {f.credits.map((credit) => (
                <li key={credit.role}>
                  <span className={styles.filmRole}>{credit.role}</span>{" "}
                  <a href={credit.sourceHref} target="_blank" rel="noopener noreferrer">
                    {credit.work}
                  </a>
                  {" · "}
                  {credit.licenceHref ? (
                    <a href={credit.licenceHref} target="_blank" rel="noopener noreferrer">
                      {credit.licence}
                    </a>
                  ) : (
                    credit.licence
                  )}
                  {credit.changes && ` · ${credit.changes}`}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </Panel>
  );
}
