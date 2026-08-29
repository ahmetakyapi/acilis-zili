import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Yazılar ekranının kendi sekmeleri — Mercek ve Bülten.
 *
 * İKİNCİ SEVİYE, İKİNCİ BİÇİM. Panelin üst sekme çubuğu (`AdminTabs`) altı
 * çizgili; bu da aynı biçimde olsaydı üst üste iki özdeş çubuk çizilir ve
 * hangisinin hangi seviyeye ait olduğu okunmazdı. Bu yüzden segment
 * denetimi: tek bir kapsül kabın içinde iki hap, seçili olan dolu.
 *
 * SUNUCU BİLEŞENİ, `usePathname` DEĞİL. Hangi sekmenin etkin olduğunu rota
 * zaten biliyor ve iki liste sayfası da sunucuda çiziliyor; adres okumak
 * için istemciye inmek, tamamen sunucuda duran bir ekrana JavaScript
 * eklemek olurdu.
 *
 * SAYILAR ARŞİVİN BÜYÜKLÜĞÜ, listenin uzunluğu değil — listeler kırpılmış
 * ve süzgeçli, oradaki satır sayısı "kaç yazı var" sorusuna yanlış cevap
 * verirdi.
 *
 * EDİTÖRLERDE ÇİZİLMİYOR. Bir yazıyı düzenlerken tür değiştirmek diye bir
 * iş yok; oradaki gezinme "Yazılara Dön" bağlantısı ve o da kendi
 * sekmesine dönüyor (bülten editörü bülten listesine).
 */

type Sekme = "mercek" | "bulten";

const SEKMELER = [
  { key: "mercek" as const, href: "/admin/yazilar", label: "Mercek Yazıları" },
  { key: "bulten" as const, href: "/admin/yazilar/bulten", label: "Bültenler" },
];

export function YazilarTabs({
  active,
  counts,
}: {
  active: Sekme;
  counts: { stories: number; briefs: number };
}) {
  return (
    /* Dar ekranda kayar: iki sekme 390 pikselde sığıyor ama etiketler
       büyürse ilk kırılacak yer burası ve kırpılmış bir sekme, var olmayan
       bir sekmedir. */
    <nav
      aria-label="Yazı türleri"
      className="no-scrollbar -mx-1 overflow-x-auto px-1"
    >
      <ul className="flex w-full min-w-max gap-1 rounded-(--radius-lg) border border-line bg-surface-elevated p-1 sm:w-fit">
        {SEKMELER.map((sekme) => {
          const secili = sekme.key === active;
          const adet = sekme.key === "mercek" ? counts.stories : counts.briefs;
          return (
            <li key={sekme.key} className="flex-1 sm:flex-none">
              <Link
                href={sekme.href}
                aria-current={secili ? "page" : undefined}
                className={cn(
                  /* 44 piksel dokunma hedefi: iki sekme yan yana ve
                     `.tap-44` komşunun hedefini çalardı. */
                  "flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-(--radius-md) px-4 text-base transition-colors sm:min-h-10",
                  secili
                    ? "bg-surface font-bold text-strong shadow-[0_1px_2px_rgb(0_0_0/0.06)]"
                    : "font-medium text-muted hover:text-strong",
                )}
              >
                {sekme.label}
                {/* SAYI RENKLE DEĞİL, KENDİ ROZETİYLE ayrışıyor: seçili
                    sekmede vurgu rengi, ötekinde nötr. */}
                <span
                  className={cn(
                    "numeral rounded-full px-1.5 py-0.5 text-nano font-bold",
                    secili
                      ? "bg-primary-wash text-primary-ink"
                      : "bg-surface text-muted",
                  )}
                >
                  {adet.toLocaleString("tr-TR")}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
