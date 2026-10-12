import * as React from "react";
import { Dots, FaceText, Line, Solid, Wire } from "@/components/iso/react/draw";
import { bellArt } from "./geometry";
import { SessionBellLive } from "./live";
import type { BellDay, BellText } from "./model";

/**
 * Statik çizim SUNUCUDA (anatomy references/react.md); her öğe prop'unun
 * kökünde kalıcı `key` (büyük sayfada tembel parça uyarısı).
 *
 * Ressam sırası arkadan öne: kaide → kadran (halka, yüz, çentik, seans
 * yayları, kontaklar, göbek) → ibre (canlı) → göbek vidası → arka direk →
 * çan (askı, gövde) → bobin ve dövücü → ön direk, travers → kablo (zeminde,
 * en önde). Sunucu canlı saati basar; çan dinlenmede.
 */
export function SessionBellArt({
  day,
  text,
  closedName,
  label,
  nowMinutes,
  nowMs,
  stamp,
}: {
  day: BellDay;
  text: BellText;
  closedName: string | null;
  label: string;
  nowMinutes: number;
  nowMs: number;
  /** Kadrana kazınmış tek etiket. */
  stamp: string;
}) {
  const art = bellArt(day);
  const { plinth, dial, yoke, bell, striker, wire } = art;

  const PLINTH = (
    <g key="plinth">
      <path className="iso-halo" d={plinth.halo} />
      {plinth.feet.map((paths, index) => (
        <Solid key={index} paths={paths} tone="lo" crease="faint" />
      ))}
      <Solid paths={plinth.slab} tone="mid" crease="faint" inner={<Line d={plinth.seam} tone="faint" />} />
      <Line d={plinth.groove} tone="faint" />
      <Line d={plinth.screwRings} tone="lo" />
      <Dots points={plinth.screws} size={0.5} tone="mid" />
      <Solid paths={plinth.plate} tone="lo" crease="none" />
      <Line d={plinth.plateRules} tone="lo" free />
      <Dots points={plinth.plateScrews} size={0.42} tone="mid" />
      <path className="iso-halo" d={bell.halo} />
    </g>
  );

  const DIAL = (
    <g key="dial">
      <Solid paths={dial.ringBase} tone="lo" crease="faint" />
      <Solid paths={dial.face} tone="mid" crease="faint" />
      <Line d={dial.bezel} tone="lo" />
      <Line d={dial.tickRing} tone="faint" />
      <Line d={dial.ticks.minor} tone="lo" />
      <Line d={dial.ticks.major} tone="mid" />
      <Line d={dial.arcTrack} tone="faint" />
      {dial.arcs.map((arc) => (
        <path key={arc.kind} className="iso-line sb-arc" data-kind={arc.kind} d={arc.d} />
      ))}
      {dial.contacts.map((paths, index) => (
        <g key={index} className="sb-contact" data-contact={index === 0 ? "open" : "close"}>
          <Solid paths={paths} tone="mid" crease="none" />
        </g>
      ))}
      <FaceText transform={dial.label} size={3.6} tone="lo" anchor="middle">
        {stamp}
      </FaceText>
      <Solid paths={dial.terminal} tone="mid" crease="faint" />
      <Line d={dial.terminalRing} tone="lo" />
      <Solid paths={dial.hub} tone="mid" crease="faint" />
    </g>
  );

  const PIN = <Dots key="pin" points={dial.hubPin} size={0.7} tone="hi" />;

  const BACK = (
    <g key="back">
      <Solid paths={yoke.backFoot} tone="lo" crease="none" />
      <Dots points={yoke.backScrews} size={0.45} tone="mid" />
      <Solid paths={yoke.back} tone="mid" crease="faint" />
    </g>
  );

  const BELL = (
    <g key="bell">
      <Solid paths={bell.hanger} tone="mid" crease="faint" />
      <g data-bell="">
        <Solid paths={bell.body} tone="hi" crease="faint" lit inner={<><Line d={bell.lip} tone="faint" /><Line d={bell.band} tone="faint" /></>} />
      </g>
    </g>
  );

  const STRIKER = (
    <g key="striker">
      <Solid paths={striker.stand} tone="lo" crease="faint" />
      <Dots points={striker.standScrews} size={0.45} tone="mid" />
      <g data-plunger="">
        <Solid paths={striker.rod} tone="mid" crease="none" />
        <Solid paths={striker.head} tone="mid" crease="none" />
      </g>
      <Solid paths={striker.coil} tone="mid" crease="faint" inner={<Line d={striker.coilSeams} tone="faint" />} />
      <Dots points={striker.coilScrews} size={0.45} tone="mid" />
    </g>
  );

  const FRONT = (
    <g key="front">
      <Solid paths={yoke.frontFoot} tone="lo" crease="none" />
      <Dots points={yoke.frontScrews} size={0.45} tone="mid" />
      <Solid paths={yoke.front} tone="mid" crease="faint" inner={<Line d={yoke.frontSeam} tone="faint" />} />
      <Solid paths={yoke.bar} tone="mid" crease="faint" />
      <Dots points={yoke.barScrews} size={0.5} tone="mid" />
      <g data-wire="" className="sb-wire">
        <Wire from={wire.from} to={wire.to} via={wire.via} tone="lo" />
      </g>
    </g>
  );

  return (
    <SessionBellLive
      day={day}
      text={text}
      closedName={closedName}
      label={label}
      nowMinutes={nowMinutes}
      nowMs={nowMs}
      plinth={PLINTH}
      dial={DIAL}
      pin={PIN}
      back={BACK}
      bell={BELL}
      striker={STRIKER}
      front={FRONT}
    />
  );
}
