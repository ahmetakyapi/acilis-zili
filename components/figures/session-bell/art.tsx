import * as React from "react";
import { Dots, FaceText, Line, Solid, Wire } from "@/components/iso/react/draw";
import { bellArt } from "./geometry";
import { SessionBellLive } from "./live";
import type { BellDay, BellText } from "./model";
import type { BellChip, BellLabels } from "./live";

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
  labels,
  chips,
  label,
  nowMinutes,
  nowMs,
  nextOpenMs,
  nextCloseMs,
  stamp,
}: {
  day: BellDay;
  text: BellText;
  labels: BellLabels;
  chips: BellChip[];
  label: string;
  nowMinutes: number;
  nowMs: number;
  nextOpenMs: number;
  nextCloseMs: number;
  /** Kadrana kazınmış tek etiket. */
  stamp: string;
}) {
  const art = bellArt(day);
  const { plinth, dial, yoke, bell, striker, wire } = art;

  const PLINTH = (
    <g key="plinth" className="sb-plinth">
      <path className="iso-halo" d={plinth.halo} />
      {plinth.feet.map((paths, index) => (
        <Solid key={index} paths={paths} tone="lo" crease="faint" />
      ))}
      <Solid className="sb-slab" paths={plinth.slab} tone="mid" crease="faint" inner={<Line d={plinth.seam} tone="faint" />} />
      <Line d={plinth.groove} tone="faint" />
      <Line d={plinth.screwRings} tone="lo" />
      <Dots points={plinth.screws} size={0.5} tone="mid" />
      <Solid className="sb-plate" paths={plinth.plate} tone="lo" crease="none" />
      <Line d={plinth.plateRules} tone="lo" free />
      <Dots points={plinth.plateScrews} size={0.42} tone="mid" />
      <path className="iso-halo" d={bell.halo} />
    </g>
  );

  const DIAL = (
    <g key="dial">
      <Solid className="sb-ring" paths={dial.ringBase} tone="lo" crease="faint" />
      <Solid className="sb-face" paths={dial.face} tone="mid" crease="faint" />
      <Line d={dial.bezel} tone="lo" />
      <Line d={dial.tickRing} tone="faint" />
      <Line d={dial.ticks.minor} tone="lo" />
      <Line d={dial.ticks.major} tone="mid" />
      {dial.wedges.map((wedge) => (
        <path key={`w-${wedge.kind}`} className="sb-wedge" data-kind={wedge.kind} d={wedge.d} />
      ))}
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
      {/* Dört ana saat — gerekçe geometry.ts → `hours`. */}
      {dial.hours.map((hour) => (
        <FaceText key={hour.text} transform={hour.transform} size={3.4} tone="mid" anchor="middle">
          {hour.text}
        </FaceText>
      ))}
      <Solid paths={dial.terminal} tone="mid" crease="faint" />
      <Line d={dial.terminalRing} tone="lo" />
      <Solid className="sb-hub" paths={dial.hub} tone="mid" crease="faint" />
      {dial.beacon ? (
        <g className="sb-beacon" aria-hidden="true">
          <circle cx={dial.beacon[0]} cy={dial.beacon[1]} r={4.2} />
          <circle cx={dial.beacon[0]} cy={dial.beacon[1]} r={4.2} />
        </g>
      ) : null}
    </g>
  );

  const PIN = <Dots key="pin" points={dial.hubPin} size={0.7} tone="hi" />;

  const BACK = (
    <g key="back">
      <Solid paths={yoke.backFoot} tone="lo" crease="none" />
      <Dots points={yoke.backScrews} size={0.45} tone="mid" />
      <Solid className="sb-post" paths={yoke.back} tone="mid" crease="faint" />
    </g>
  );

  const BELL = (
    <g key="bell">
      <Solid paths={bell.hanger} tone="mid" crease="faint" />
      {/* Ses halkaları çanın ARKASINDA başlıyor ama halka çandan geniş;
          önde kalan yarısı direğin önünde değil — FRONT katmanı sonra. */}
      <g className="sb-waves" aria-hidden="true">
        {bell.waves.map((d, index) => (
          <path key={index} d={d} data-wave={index} />
        ))}
      </g>
      <g data-bell="">
        <Solid className="sb-bell-body" paths={bell.body} tone="hi" crease="faint" lit inner={<><Line d={bell.lip} tone="faint" /><Line d={bell.band} tone="faint" /></>} />
      </g>
    </g>
  );

  const STRIKER = (
    <g key="striker">
      <Solid paths={striker.stand} tone="lo" crease="faint" />
      <Dots points={striker.standScrews} size={0.45} tone="mid" />
      <g data-plunger="">
        <Solid paths={striker.rod} tone="mid" crease="none" />
        <Solid className="sb-head-ball" paths={striker.head} tone="mid" crease="none" />
      </g>
      <Solid className="sb-coil" paths={striker.coil} tone="mid" crease="faint" inner={<Line d={striker.coilSeams} tone="faint" />} />
      <Dots points={striker.coilScrews} size={0.45} tone="mid" />
    </g>
  );

  const FRONT = (
    <g key="front">
      <Solid paths={yoke.frontFoot} tone="lo" crease="none" />
      <Dots points={yoke.frontScrews} size={0.45} tone="mid" />
      <Solid className="sb-post" paths={yoke.front} tone="mid" crease="faint" inner={<Line d={yoke.frontSeam} tone="faint" />} />
      <Solid className="sb-post" paths={yoke.bar} tone="mid" crease="faint" />
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
      labels={labels}
      chips={chips}
      label={label}
      nowMinutes={nowMinutes}
      nowMs={nowMs}
      nextOpenMs={nextOpenMs}
      nextCloseMs={nextCloseMs}
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
