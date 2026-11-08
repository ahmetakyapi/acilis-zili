#!/usr/bin/env bash
#
# Açılış Zili — sunucuda migration durumu / uygulaması (16 Ekim).
# Uygulama kullanıcısı olarak, CANLI sürümün dizininde çalışır:
#
#   sudo -u acilis -H bash -s -- check|apply|diagnose|cleanup [kabul-ozeti] < deploy/remote-migrate.sh
#
# `cleanup` (8 Kasım, sahibinin isteği: "içinde başka projeden bir şey
# kalmasın"): veritabanı 8 Kasım'a dek sek-sek (`memleket_*`), oxxo
# (`app_state*`) ve sahipsiz boş `oyz_*` tablolarıyla ORTAKTI; projeler
# kendi veritabanlarına taşındıktan sonra bu tabloları ve oxxo'nun
# kayıttaki migration satırını tek işlemde siler. Yalnız sabit ad kalıbına
# uyan VE depodaki şemada OLMAYAN tablolar; satırı ancak özeti verilirse ve
# depodaki hiçbir dosyaya uymuyorsa.
#
# `diagnose` (8 Kasım, salt okunur): üretim şemasını depodaki son şema
# anlık görüntüsüyle (drizzle/meta/<son>_snapshot.json) karşılaştırır,
# depoda tanımı olmayan ya da eksik tablo/sütunu basar. `apply`a ikinci
# argüman olarak kayıttaki eşleşmeyen satırın içerik özeti (en az 12 hex)
# verilirse güvenlik durdurması YALNIZ o tek satır için geçilir: kayıt
# silinmez, durum bilinçli kabul edilir (bkz. teşhis satırı).
#
# Migration'lar deploy'da UYGULANMAZ (CLAUDE.md). Üretim DATABASE_URL'i
# yalnız sunucuda (/etc/acilis-zili.env) duruyor; bu betik onu ortama alıp
# önce DURUMU basar: drizzle'ın kayıt tablosundaki son migration ile
# depodaki listeyi karşılaştırır, bekleyenleri adıyla sayar. `apply` ancak
# kayıt tablosu varsa ve bekleyenler listenin SONUNDAYSA koşar — tablo
# yoksa ya da kayıt depodan ilerideyse (başka daldan uygulanmış) durur.
# Adres hiçbir çıktıya yazılmaz.

set -euo pipefail
MODE="${1:-check}"
ACCEPT="${2:-}"
[[ "$MODE" =~ ^(check|apply|diagnose|cleanup)$ ]] || { echo "geçersiz mod" >&2; exit 1; }
[[ -z "$ACCEPT" || "$ACCEPT" =~ ^[0-9a-f]{12,64}$ ]] || { echo "geçersiz kabul özeti" >&2; exit 1; }
cd /srv/acilis-zili/current
set -a
# shellcheck disable=SC1091
. /etc/acilis-zili.env
set +a
[[ -n "${DATABASE_URL:-}" ]] || { echo "DATABASE_URL tanımlı değil" >&2; exit 1; }

status() {
node --input-type=module - "$MODE" "$ACCEPT" <<'JS'
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { neon } from "@neondatabase/serverless";
const mode = process.argv[2];
const accept = process.argv[3] || "";
const sql = neon(process.env.DATABASE_URL);
const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")).entries;
let applied;
try {
  applied = await sql`select hash, created_at from drizzle.__drizzle_migrations order by created_at`;
} catch (error) {
  console.log("KAYIT TABLOSU YOK (drizzle.__drizzle_migrations):", error.message);
  process.exit(2);
}
const last = applied.length ? Number(applied[applied.length - 1].created_at) : 0;
const pending = journal.filter((entry) => entry.when > last);
const tables = await sql`select to_regclass('public.email_prefs') as email_prefs, to_regclass('public.email_log') as email_log, to_regclass('public.notifications') as notifications, to_regclass('public.percent_alerts') as percent_alerts`;
console.log(`depoda ${journal.length} migration, kayıtta ${applied.length} satır; son uygulanan: ${journal.find((e) => e.when === last)?.tag ?? "(depoda yok!)"}`);
console.log(`bekleyen: ${pending.length ? pending.map((e) => e.tag).join(", ") : "yok"}`);
console.log("tablolar:", JSON.stringify(tables[0]));
/* TEŞHİS (8 Kasım): kayıtta depoyla eşleşmeyen satırları tarih ve içerik
   özetiyle bas. drizzle her satıra dosya içeriğinin SHA-256'sını yazıyor
   (drizzle-orm/migrator.js); özet depodaki bir dosyayla eşleşiyorsa satır
   o dosyanın başka bir `when` ile uygulanmış hâli, eşleşmiyorsa depoda
   hiç olmayan bir migration (ör. commit'lenmemiş yerel dosyayla
   `db:migrate`). Sahibinin elle sorgu koşması gerekmesin. */
const byHash = new Map(journal.map((e) => [createHash("sha256").update(readFileSync(`drizzle/${e.tag}.sql`, "utf8")).digest("hex"), e.tag]));
const stray = applied.filter((row) => !journal.some((e) => e.when === Number(row.created_at)));
for (const row of stray) {
  const when = new Date(Number(row.created_at)).toISOString();
  console.log(`eşleşmeyen kayıt: ${when} · özet ${String(row.hash).slice(0, 12)} · ${byHash.has(row.hash) ? `içerik ${byHash.get(row.hash)} ile AYNI` : "içerik depodaki hiçbir dosyaya uymuyor"}`);
}
const snapTag = journal[journal.length - 1];
const snap = JSON.parse(readFileSync(`drizzle/meta/${String(snapTag.idx).padStart(4, "0")}_snapshot.json`, "utf8"));
const expected = new Map();
for (const table of Object.values(snap.tables)) {
  if ((table.schema || "public") !== "public") continue;
  expected.set(table.name, new Set(Object.keys(table.columns)));
}
/* cleanup: başka projelerin artığını sil (bkz. baş yorum). Kalıp SABİT;
   girdiden tablo adı alınmaz. */
if (mode === "cleanup") {
  const FOREIGN = /^(memleket_[a-z_]+|oyz_[a-z_]+|app_state|app_state_history)$/;
  /* oxxo verisi 1 Kasım 11:29:34.700 UTC'deki hâliyle yeni veritabanına
     kopyalandı; eski tabloya sonradan yazılmışsa (taşıma sırasında açık
     kalan sekme) silmek veri kaybıdır — dur, önce yeniden kopyala. */
  const OXXO_COPIED_AT = Date.parse("2026-11-01T11:29:34.700Z");
  const present = (await sql`select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name`).map((r) => r.table_name);
  const targets = present.filter((name) => FOREIGN.test(name) && !expected.has(name));
  if (targets.includes("app_state")) {
    const [row] = await sql.query(`select max(updated_at) as m from "app_state"`);
    if (row?.m && new Date(row.m).getTime() > OXXO_COPIED_AT) {
      console.log(`DUR: app_state kopyadan sonra güncellenmiş (${new Date(row.m).toISOString()}); önce oxxo'ya yeniden kopyala`);
      process.exit(3);
    }
  }
  const foreignRows = stray.filter((row) => !byHash.has(row.hash));
  if (stray.length !== foreignRows.length) { console.log("DUR: eşleşmeyen kayıtlardan biri depodaki bir dosyayla aynı; silinmez"); process.exit(3); }
  if (foreignRows.length && !(accept && foreignRows.length === 1 && String(foreignRows[0].hash).startsWith(accept))) {
    console.log("DUR: kayıttaki yabancı satırın özeti accept_stray ile verilmeli");
    process.exit(3);
  }
  for (const name of targets) {
    const [c] = await sql.query(`select count(*)::int as n from "${name}"`);
    console.log(`silinecek tablo: ${name} (${c.n} satır)`);
  }
  const queries = targets.map((name) => sql.query(`drop table "${name}"`));
  if (foreignRows.length) queries.push(sql.query("delete from drizzle.__drizzle_migrations where hash = $1", [foreignRows[0].hash]));
  if (!queries.length) { console.log("temizlenecek bir şey yok"); process.exit(0); }
  await sql.transaction(queries);
  console.log(`TEMİZLENDİ: ${targets.length} tablo${foreignRows.length ? ", 1 kayıt satırı" : ""}`);
  process.exit(0);
}
/* diagnose salt okunur: durdurmadan önce şemayı karşılaştırıp çıkar. */
if (mode === "diagnose") {
  const cols = await sql`select table_name, column_name from information_schema.columns where table_schema = 'public' order by table_name, ordinal_position`;
  const actual = new Map();
  for (const row of cols) {
    if (!actual.has(row.table_name)) actual.set(row.table_name, new Set());
    actual.get(row.table_name).add(row.column_name);
  }
  const pendingNote = pending.length ? ` (bekleyen: ${pending.map((e) => e.tag).join(", ")})` : "";
  let diff = 0;
  for (const [name, set] of actual) {
    if (!expected.has(name)) { console.log(`FAZLA TABLO: ${name} (${[...set].join(", ")})`); diff++; continue; }
    for (const c of set) if (!expected.get(name).has(c)) { console.log(`FAZLA SÜTUN: ${name}.${c}`); diff++; }
  }
  for (const [name, set] of expected) {
    if (!actual.has(name)) { console.log(`EKSİK TABLO: ${name}${pendingNote}`); diff++; continue; }
    for (const c of set) if (!actual.get(name).has(c)) { console.log(`EKSİK SÜTUN: ${name}.${c}${pendingNote}`); diff++; }
  }
  console.log(diff ? `şema farkı: ${diff}` : "şema depoyla aynı");
  process.exit(0);
}
if (last && !journal.some((e) => e.when === last)) {
  /* Bilinçli kabul: yalnız apply'da, tek eşleşmeyen satır ve özeti
     verilen önekle başlıyorsa. Drizzle bekleyeni son kaydın damgasından
     seçer; eşleşmeyen satır depodaki son migration'dan ESKİYSE bekleyenler
     yine sırayla uygulanır. */
  const ok = mode === "apply" && accept && stray.length === 1 && String(stray[0].hash).startsWith(accept);
  if (!ok) { console.log("DUR: kayıttaki son migration depoda yok"); process.exit(3); }
  console.log(`KABUL: eşleşmeyen kayıt (${accept}) bilinçli kabul edildi; kayıt silinmedi`);
}

if (mode === "apply" && pending.length === 0) console.log("uygulanacak bir şey yok");
process.exit(0);
JS
}

if [[ "$MODE" == "diagnose" ]]; then
	status
	exit 0
fi
status
if [[ "$MODE" == "apply" ]]; then
	npx --no-install drizzle-kit migrate
	echo "--- sonrası ---"
	MODE=check ACCEPT="" status
fi
