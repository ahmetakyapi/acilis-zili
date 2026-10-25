import { SECTOR_FUNDS } from "@/db/seed/symbols";
import { CARD_INDEX_NAMES } from "@/lib/day-card";
import type { DayPoster } from "@/lib/day-poster";
import { posterStory, storyText, type PosterStory, type StoryText } from "@/lib/day-poster-story";
import { OTHER_DISTRICT, districtMoves, type District } from "@/lib/day-skyline";
import type { Dictionary, Locale } from "@/lib/i18n";
import { INTL_LOCALE } from "@/lib/i18n/config";
import { daySignatureEn, daySignatureTr } from "@/lib/i18n/dictionaries/day-signature";
import { formatPercentPlain } from "@/lib/utils";

/**
 * Posterin adları ve cümlesi — sayfa, `/gun` arşivi, ana sayfa şeridi,
 * paylaşım görseli ve meta açıklaması AYNI cümleyi buradan alıyor
 * (kurallar `lib/day-poster-story.ts`). Düz modül, `"use client"` değil.
 */

/** Cümledeki yüzde basamağı — künyeler ve etiketlerle aynı (iki). */
const STORY_DIGITS = 2;

/** Sektör fonu, mahalle ya da endeks fonu → okunur ad ("Enerji",
 *  "Diğer Sektörler", "Nasdaq 100"). Bülten künyesi de kullanıyor. */
export function posterName(symbol: string, locale: Locale): string {
  const fund = SECTOR_FUNDS.find((entry) => entry.symbol === symbol);
  if (fund) return locale === "tr" ? fund.nameTr : fund.nameEn;
  if (symbol === OTHER_DISTRICT) return (locale === "tr" ? daySignatureTr : daySignatureEn).skyline.otherDistrict;
  return CARD_INDEX_NAMES[symbol] ?? symbol;
}

export function posterStoryOf(poster: DayPoster, districts: readonly District[]): PosterStory {
  return posterStory({ indices: poster.indices, breadth: poster.breadth, sectors: districtMoves(districts) });
}

export function posterStoryText(poster: DayPoster, districts: readonly District[], locale: Locale, t: Dictionary): StoryText {
  const list = new Intl.ListFormat(INTL_LOCALE[locale], { style: "long", type: "conjunction" });
  return storyText(posterStoryOf(poster, districts), t.daySignature.story, {
    name: (symbol) => posterName(symbol, locale),
    percent: (value) => formatPercentPlain(value, locale, STORY_DIGITS),
    list: (items) => list.format(items),
  });
}
