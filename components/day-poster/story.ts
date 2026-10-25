import { SECTOR_FUNDS } from "@/db/seed/symbols";
import { CARD_INDEX_NAMES } from "@/lib/day-card";
import type { DayPoster } from "@/lib/day-poster";
import { posterStory, storyText, type StoryText } from "@/lib/day-poster-story";
import type { Dictionary, Locale } from "@/lib/i18n";
import { INTL_LOCALE } from "@/lib/i18n/config";
import { formatPercentPlain } from "@/lib/utils";

/**
 * Posterin adları ve cümlesi — sayfa, `/gun` arşivi, paylaşım görseli ve
 * meta açıklaması AYNI cümleyi buradan alıyor (kurallar
 * `lib/day-poster-story.ts`). Düz modül, `"use client"` değil.
 */

/** Cümledeki yüzde basamağı — tablo ve kulvarlarla aynı (iki). */
const STORY_DIGITS = 2;

/** Sektör fonu ya da endeks fonu → okunur ad ("Enerji", "S&P 500"). */
export function posterName(symbol: string, locale: Locale): string {
  const fund = SECTOR_FUNDS.find((entry) => entry.symbol === symbol);
  if (fund) return locale === "tr" ? fund.nameTr : fund.nameEn;
  return CARD_INDEX_NAMES[symbol] ?? symbol;
}

export function posterStoryText(poster: DayPoster, locale: Locale, t: Dictionary): StoryText {
  const list = new Intl.ListFormat(INTL_LOCALE[locale], { style: "long", type: "conjunction" });
  return storyText(posterStory(poster), t.daySignature.story, {
    name: (symbol) => posterName(symbol, locale),
    percent: (value) => formatPercentPlain(value, locale, STORY_DIGITS),
    list: (items) => list.format(items),
  });
}
