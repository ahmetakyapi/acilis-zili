"use client";

import { useEffect } from "react";
import { setBellEnergy } from "./bell-energy";

/** Kapanış künyesinin zile verdiği şiddet — gerekçe `bell-energy.ts`. Hiçbir şey çizmez. */
export function BellEnergySource({ value }: { value: number }) {
  useEffect(() => {
    setBellEnergy(value);
    return () => setBellEnergy(0);
  }, [value]);
  return null;
}
