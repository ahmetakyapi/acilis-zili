"use client";

import { useId, useState, type KeyboardEvent, type ReactNode } from "react";
import { TabUnderline } from "@/components/ui/TabUnderline";
import styles from "./CoverTabs.module.css";

type TabKey = "leaders" | "sectors";
const ORDER = ["leaders", "sectors"] as const;

/**
 * /sirketler kapağının sağ paneli — "Piyasanın Devleri" | "Sektör Dağılımı"
 * (25 Ekim, sahibinin isteği: "Sektör dağılımı buraya tablı olsun").
 *
 * İki panel de SUNUCUDA çizilip slot olarak geliyor (BriefSwitch kalıbı):
 * geçişte ağ isteği yok, istemci demetine yalnız bu küçük anahtar giriyor.
 * Seçim adreste DEĞİL: aynı kartın öteki yüzü, gezinme değil; tablo
 * süzgeci zaten adreste (`sektor=`).
 *
 * JS KAPALIYKEN: sunucu varsayılan sekmeyi basıyor, ikinci panel gizli
 * (`data-inactive`, CSS).
 *
 * YÜKSEKLİK SABİT (≥640): iki panel aynı ızgara hücresinde üst üste,
 * gizli olan `visibility:hidden` ile yer tutuyor; kart boyu iki panelin
 * büyüğü (devler) ve sekme değişince alttaki tablo kımıldamıyor (CLS 0).
 * Telefonda devler tek satırlık şerit ve sektör paneli ondan uzun; orada
 * üst üste koymak varsayılan sekmede kartı uzatıp tablo başını aşağı
 * iterdi. Telefonda gizli panel gerçekten gizli; sektör sekmesini seçen
 * okuyucu kartın uzadığını kendi eliyle görüyor.
 *
 * SEKME SÖZLEŞMESİ (ARIA tabs): ok tuşları, Home/End; gezici sekme sırası.
 * Geçiş kısa (`--ease-brand`) ve yalnız okuyucu seçtiğinde; ilk ekran
 * hidrasyonda kımıldamaz. Azaltılmış harekette anında.
 */
export function CoverTabs({
  leaders,
  sectors,
  labels,
}: {
  leaders: ReactNode;
  /** Arama varken null: bir aramanın sonucu dağılım değil, tek tek şirketler. */
  sectors: ReactNode | null;
  labels: { group: string; leaders: string; leadersMeta: string; sectors: string; sectorsMeta: string };
}) {
  const [tab, setTab] = useState<TabKey>("leaders");
  const [entered, setEntered] = useState<TabKey | null>(null);
  const id = useId();
  const tabId = (key: TabKey) => `${id}-tab-${key}`;
  const panelId = (key: TabKey) => `${id}-panel-${key}`;

  if (!sectors) {
    return <section className={styles.cover} aria-labelledby={`${id}-solo`}>
      <div className={styles.head}>
        <h2 id={`${id}-solo`} className={styles.solo}>{labels.leaders}</h2>
        <span className={styles.meta}>{labels.leadersMeta}</span>
      </div>
      {leaders}
    </section>;
  }

  const choose = (next: TabKey) => {
    if (next === tab) return;
    setEntered(next);
    setTab(next);
  };
  function onKey(event: KeyboardEvent<HTMLButtonElement>) {
    const now = ORDER.indexOf(tab);
    let next = now;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (now + 1) % ORDER.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (now - 1 + ORDER.length) % ORDER.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = ORDER.length - 1;
    else return;
    event.preventDefault();
    choose(ORDER[next]);
    document.getElementById(tabId(ORDER[next]))?.focus();
  }

  const titles: Record<TabKey, string> = { leaders: labels.leaders, sectors: labels.sectors };
  const metas: Record<TabKey, string> = { leaders: labels.leadersMeta, sectors: labels.sectorsMeta };
  const bodies: Record<TabKey, ReactNode> = { leaders, sectors };

  return <section className={styles.cover} data-cover-switched={entered ? true : undefined}>
    <div className={styles.head}>
      <div role="tablist" aria-label={labels.group} className={styles.tabs}>
        {ORDER.map((key) => <button
          key={key}
          type="button"
          role="tab"
          id={tabId(key)}
          aria-controls={panelId(key)}
          aria-selected={tab === key}
          tabIndex={tab === key ? 0 : -1}
          data-tab={key}
          onKeyDown={onKey}
          onClick={() => choose(key)}
          className={styles.tab}
        >
          <span className={styles.tabText}>
            {titles[key]}
            {/* Çizgi sekmeden sekmeye kayıyor (site kalıbı); metnin 6
                piksel altında, 44 piksellik dokunma kutusunun dibinde değil. */}
            {tab === key && <span className={styles.underline}><TabUnderline layoutId={`${id}-underline`} /></span>}
          </span>
        </button>)}
      </div>
      <span className={styles.meta}>{metas[tab]}</span>
    </div>
    <div className={styles.panels}>
      {ORDER.map((key) => <div
        key={key}
        role="tabpanel"
        id={panelId(key)}
        aria-labelledby={tabId(key)}
        /* `hidden` DEĞİL: Tailwind ön stili `[hidden]`ı `!important` ile
           `display:none` yapıyor ve ≥640'taki yer tutmayı eziyordu
           (ölçüldü: sekme değişince kart 10,8 piksel kısaldı). Gizleme
           CSS'te (`data-inactive`), odak ve erişilebilirlik ağacından
           çıkarma `inert` ile. */
        data-inactive={tab !== key || undefined}
        inert={tab !== key}
        /* Giriş yalnız okuyucu bu sekmeyi seçtiğinde. */
        data-enter={entered === key && tab === key ? true : undefined}
        className={styles.panel}
      >
        {/* Her panelin h2'si (ekran düzeni kuralı): görünen ad sekmede,
            başlık gezinmesi için burada. */}
        <h2 className="sr-only">{titles[key]}</h2>
        {bodies[key]}
      </div>)}
    </div>
  </section>;
}
