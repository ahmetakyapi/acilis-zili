/**
 * `brandFilm` namespace: the "Zil Çalıyor" promo film on the About page
 * (8 Nov 2026). Part of the dictionary (tr.ts / en.ts put it under the
 * `brandFilm` key), kept in its own file so feature work does not scatter
 * keys through the middle of the dictionary (see brief-ledger.ts).
 *
 * The film is made with cinecode outside the repo (docs/film-kimligi.md);
 * only the compressed MP4 and its poster live in public/film/.
 */

type Credit = {
  /** What the source is in the film: Title Case label ("Müzik"). */
  role: string;
  /** Title and maker, as the licence asks for them. */
  work: string;
  /** The licence's short name, linked when it has a deed. */
  licence: string;
  licenceHref?: string;
  /** The work's own page. */
  sourceHref: string;
  /** What was changed; CC BY asks for it. Empty when nothing was. */
  changes: string;
};

export const brandFilmTr = {
  title: "Tanıtım Filmi",
  body: [
    "On beş saniyede sitenin tek bir anı: New York açılışına geri sayım İstanbul saatiyle sıfıra iner, zil çalar. Ana sayfadaki geri sayım da aynısını yapar; sıfırlanınca zil kendiliğinden çalar.",
    "Film baştan sona kodla çizildi. Zil, sitenin bekleme ve boş durum sahnelerindeki fırça zilinin ta kendisi; renkler ve yazı sitenin renkleri ve yazısı.",
  ],
  /* {open}: today's opening in Istanbul time, from `timePair` (the film
     shows one season; the page says which and gives today's hour, never a
     fixed one: CLAUDE.md "Saat: TR Önce"). */
  seasonNote: "Filmdeki 17:30 kış saati. Şu dönemde açılış İstanbul saatiyle {open}.",
  /* Only the English page needs it: the film's words are Turkish. */
  languageNote: "",
  videoLabel: "Zil Çalıyor tanıtım filmi, 15 saniye",
  creditsTitle: "Künye",
  credits: [
    {
      role: "Müzik",
      work: "“Pizzicato”, Ehma",
      licence: "CC BY 3.0",
      licenceHref: "https://creativecommons.org/licenses/by/3.0/",
      sourceHref: "https://www.jamendo.com/track/1687311",
      changes: "15 saniyelik bölümü kesildi, seviyesi ayarlandı.",
    },
    {
      role: "Zil Sesi",
      work: "“Striking a bell 15cm large”, stephan, Wikimedia Commons",
      licence: "Kamu Malı",
      licenceHref: "https://creativecommons.org/publicdomain/mark/1.0/",
      sourceHref: "https://commons.wikimedia.org/wiki/File:Striking_a_bell_15cm_large.ogg",
      changes: "Perdesi düşürüldü.",
    },
    {
      role: "Saat Sesi",
      work: "“Clock (tic tac)”, Saaabaaato, Wikimedia Commons",
      licence: "CC0",
      licenceHref: "https://creativecommons.org/publicdomain/zero/1.0/",
      sourceHref: "https://commons.wikimedia.org/wiki/File:Clock_(tic_tac).ogg",
      changes: "",
    },
  ] as Credit[],
};

export const brandFilmEn: typeof brandFilmTr = {
  title: "Promo Film",
  body: [
    "One moment of the site in fifteen seconds: the countdown to the New York open reaches zero on Istanbul time and the bell rings. The countdown on the home page does the same; when it reaches zero the bell rings by itself.",
    "The film is drawn entirely in code. The bell is the same brush bell the site uses in its loading and empty states; the colours and the type are the site's own.",
  ],
  seasonNote: "The film shows 17:30, the winter hour. In the current season the open is at {open} Istanbul time.",
  languageNote: "The words in the film are Turkish.",
  videoLabel: "Zil Çalıyor promo film, 15 seconds",
  creditsTitle: "Credits",
  credits: [
    {
      role: "Music",
      work: "“Pizzicato”, Ehma",
      licence: "CC BY 3.0",
      licenceHref: "https://creativecommons.org/licenses/by/3.0/",
      sourceHref: "https://www.jamendo.com/track/1687311",
      changes: "A 15-second section cut, level adjusted.",
    },
    {
      role: "Bell",
      work: "“Striking a bell 15cm large”, stephan, Wikimedia Commons",
      licence: "Public Domain",
      licenceHref: "https://creativecommons.org/publicdomain/mark/1.0/",
      sourceHref: "https://commons.wikimedia.org/wiki/File:Striking_a_bell_15cm_large.ogg",
      changes: "Pitched down.",
    },
    {
      role: "Clock",
      work: "“Clock (tic tac)”, Saaabaaato, Wikimedia Commons",
      licence: "CC0",
      licenceHref: "https://creativecommons.org/publicdomain/zero/1.0/",
      sourceHref: "https://commons.wikimedia.org/wiki/File:Clock_(tic_tac).ogg",
      changes: "",
    },
  ],
};
