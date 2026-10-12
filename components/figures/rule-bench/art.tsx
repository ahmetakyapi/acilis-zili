import * as React from "react";
import { Dots, FaceText, Line, Solid } from "@/components/iso/react/draw";
import { benchArt } from "./geometry";
import { RuleBenchLive, type BenchLabels, type BenchSummary } from "./live";
import { finalPose, type BenchData } from "./model";

/**
 * Statik çizim SUNUCUDA: bütün yollar burada JSX olur ve canlı bileşene
 * öğe olarak geçer (anatomy references/react.md). Her öğe prop'unun kökünde
 * kalıcı bir `key` var: büyük sayfada React bu prop'ları tembel parçalar
 * hâlinde akıtıyor ve anahtarsız kök "unique key" uyarısı basıyor.
 *
 * Ressam sırası arkadan öne: taban → arka sıra (istasyon gövdeleri, lambalar,
 * direkler, kapının dayanağı) → ray → kızak → yoklayıcılar (gövde ve kol
 * kızağın ÜSTÜNDE) → kapı kolu (en önde, rayın önündeki göbekte).
 * Sunucu SON POZU basar: lambalar yanık, kızak son durakta.
 */
export function RuleBenchArt({ data, summary, labels, label }: { data: BenchData; summary: BenchSummary; labels: BenchLabels; label: string }) {
  const art = benchArt(data.stations.map((station) => station.statuses.length));
  const rest = finalPose(data);
  const { base, ruler, rail, stations, sled, gate } = art;

  const BASE = (
    <g key="base">
      <path className="iso-halo" d={base.halo} />
      {base.feet.map((paths, index) => (
        <Solid key={index} paths={paths} tone="lo" crease="faint" />
      ))}
      <Solid paths={base.slab} tone="mid" crease="faint" />
      <Line d={base.groove} tone="faint" />
      <Line d={base.screwRings} tone="lo" />
      <Dots points={base.screws} size={0.5} tone="mid" />
      <Solid paths={base.plate} tone="lo" crease="none" />
      <Line d={base.plateRules} tone="lo" free />
      <Dots points={base.plateScrews} size={0.42} tone="mid" />
      <Solid paths={ruler.strip} tone="lo" crease="none" />
      <Line d={ruler.edge} tone="lo" />
      <Line d={ruler.minor} tone="lo" />
      <Line d={ruler.major} tone="mid" />
    </g>
  );

  const BACK_ROW = (
    <g key="back-row">
      <Solid paths={gate.rest} tone="lo" crease="faint" />
      {stations.map((station, index) => (
        <g key={index} className="rb-station">
          <Solid paths={station.block} tone="mid" crease="faint" inner={<Line d={station.seam} tone="faint" />} />
          <Dots points={station.screws} size={0.45} tone="mid" />
          <Line d={station.bezels} tone="lo" />
          {station.lamps.map((paths, lamp) => (
            <g
              key={lamp}
              className="rb-lamp"
              data-lamp={`${index}-${lamp}`}
              data-status={data.stations[index].statuses[lamp]}
              data-on={lamp < rest.lit[index] ? "" : undefined}
            >
              <Solid paths={paths} tone="mid" crease="none" />
            </g>
          ))}
          <Solid paths={station.post} tone="mid" crease="faint" />
        </g>
      ))}
    </g>
  );

  const RAIL = (
    <g key="rail">
      <Solid paths={rail.bar} tone="mid" crease="faint" />
      {rail.stops.map((paths, index) => (
        <Solid key={index} paths={paths} tone="mid" crease="faint" />
      ))}
      <Dots points={rail.stopScrews} size={0.45} tone="mid" />
    </g>
  );

  const CARRIAGE = (
    <g key="carriage">
      <path className="iso-halo" d={sled.halo} />
      <Solid paths={sled.plate} tone="mid" crease="faint" />
      <Line d={sled.groove} tone="faint" />
      <Solid paths={sled.part} tone="hi" crease="faint" lit />
      <FaceText transform={sled.label} size={3.4} tone="hi" anchor="middle">
        {data.symbol}
      </FaceText>
    </g>
  );

  const PROBES = (
    <g key="probes">
      {stations.map((station, index) => (
        <g key={index}>
          <g data-rod={index}>
            <Solid paths={station.rod} tone="mid" crease="none" />
          </g>
          <Solid paths={station.housing} tone="mid" crease="faint" />
          <Solid paths={station.arm} tone="mid" crease="faint" />
          <Line d={station.armLine} tone="faint" />
          <Dots points={station.armScrews} size={0.45} tone="mid" />
        </g>
      ))}
    </g>
  );

  const GATE = (
    <g key="gate">
      <Solid paths={gate.hub} tone="mid" crease="faint" />
      <Line d={gate.hubRing} tone="lo" />
      <g data-arm="up" visibility={rest.armDown ? "hidden" : "visible"}>
        <Solid paths={gate.up} tone="mid" crease="faint" />
      </g>
      <g data-arm="down" className="rb-gate-down" visibility={rest.armDown ? "visible" : "hidden"}>
        <Solid paths={gate.down} tone="mid" crease="faint" />
      </g>
    </g>
  );

  return (
    <RuleBenchLive
      data={data}
      summary={summary}
      labels={labels}
      label={label}
      base={BASE}
      backRow={BACK_ROW}
      rail={RAIL}
      carriage={CARRIAGE}
      probes={PROBES}
      gate={GATE}
    />
  );
}
