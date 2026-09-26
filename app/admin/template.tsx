/**
 * Yönetim panelinin sayfa geçişi (26 Eylül).
 *
 * Panelde hiç hareket yoktu: sekmeler arasında gezinmek içeriği tek karede
 * değiştiriyordu ve sitenin geri kalanıyla aynı ürün gibi durmuyordu. Kamu
 * tarafındaki şablonun (`app/(app)/template.tsx`) aynısı: `template` her
 * gezinmede yeniden bağlanıyor, başlık ve paneller sırayla iniyor
 * (`.page-enter`, globals.css). Üst çubuk layout'ta, yerinde kalıyor.
 */
export default function AdminTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="page-enter">{children}</div>;
}
