"use client";

import { usePathname } from "next/navigation";

/**
 * Sayfa geçişinin görünür tarafı — gelen içerik kendi girişini yapar.
 *
 * Bugüne kadar gezinmede yalnızca BAŞLIK hareket ediyordu (`page-heading-copy`
 * imzası); gövde bir kare içinde yerine oturuyordu. Ölçüldü (canlı,
 * /piyasalar → /teknik, 1280×760): tıklamadan 500 ms sonra sayfa tamamen
 * çizilmiş, başlık maskesinden çıkıyor ama paneller, kartlar ve şerit
 * kesme gibi beliriyordu.
 *
 * ANAHTAR YOLDA, SORGUDA DEĞİL. Düzen kalıcı olduğu için bu sarmal da
 * kalıcı: CSS animasyonu yeniden başlasın diye her yolda YENİ bir öğe
 * gerekiyor. Sorgu değişimleri (filtre, sıralama) anahtarın dışında —
 * yoksa tablonun ortasında sıralamayı değiştiren okuyucu bütün sayfayı
 * yeniden kurdurur ve istemci durumunu (karşılaştırma aralığı, açık
 * satırlar) kaybederdi.
 *
 * YALNIZCA OPAKLIK. Bir `transform` burada sayfanın tamamını kapsayan bir
 * içerme bloğu kurar: içerideki her `position: sticky` bölüm çubuğu ve
 * `fixed` katman ona göre konumlanır, yani geçiş boyunca yapışkan başlıklar
 * kayar. Derinliği zaten tonla kuruyoruz; burada da hareket değil ton.
 */
export function RouteFrame({ children }: { children: React.ReactNode }) {
  return (
    <div key={usePathname()} className="route-frame">
      {children}
    </div>
  );
}
