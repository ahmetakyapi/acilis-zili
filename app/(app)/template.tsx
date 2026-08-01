/**
 * Sayfa geçişi kabuğu.
 *
 * `layout` aksine `template` her gezinmede yeniden bağlanır — animasyonun
 * her sayfa değişiminde bir kez oynaması bu yüzden buraya kondu. Masthead,
 * alt şerit ve sekme çubuğu layout'ta olduğu için yerinde kalır; yalnızca
 * içerik alanı yumuşayarak gelir.
 */
export default function AppTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="page-enter">{children}</div>;
}
