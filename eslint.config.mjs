import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Açıklayıcı figürler (components/iso kiti, components/figures) bilinçli
    // olarak React'in dışında hareket eder: kare başına ref'e yazar, yeniden
    // çizmez. react-hooks 7'nin derleyici kuralları bu deseni hata sayar
    // (dev-starter mistakes.md #98). Kapsam yalnız figür dizinleri; React
    // Compiler açılırsa figürün canlı bileşenine "use no memo" yazılır.
    files: ["components/iso/**", "components/figures/**"],
    rules: {
      "react-hooks/refs": "off",
      "react-hooks/immutability": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/exhaustive-deps": "off",
      // lathe.mjs (anatomy, kopyalanan kit) kısa devre ifadesi kullanıyor; kitin kendi kodu.
      "@typescript-eslint/no-unused-expressions": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Claude Code'un geçici çalışma kopyaları (alt ajanlar) — depo kodu değil.
    ".claude/**",
  ]),
]);

export default eslintConfig;
