#!/usr/bin/env bash
#
# Açılış Zili — sunucuda migration durumu / uygulaması (16 Ekim).
# Uygulama kullanıcısı olarak, CANLI sürümün dizininde çalışır:
#
#   sudo -u acilis -H bash -s -- check|apply < deploy/remote-migrate.sh
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
cd /srv/acilis-zili/current
set -a
# shellcheck disable=SC1091
. /etc/acilis-zili.env
set +a
[[ -n "${DATABASE_URL:-}" ]] || { echo "DATABASE_URL tanımlı değil" >&2; exit 1; }

status() {
node --input-type=module - "$MODE" <<'JS'
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
const mode = process.argv[2];
const sql = neon(process.env.DATABASE_URL);
const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")).entries;
let applied;
try {
  applied = await sql`select created_at from drizzle.__drizzle_migrations order by created_at`;
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
if (last && !journal.some((e) => e.when === last)) { console.log("DUR: kayıttaki son migration depoda yok"); process.exit(3); }
if (mode === "apply" && pending.length === 0) console.log("uygulanacak bir şey yok");
process.exit(0);
JS
}

status
if [[ "$MODE" == "apply" ]]; then
	npx --no-install drizzle-kit migrate
	echo "--- sonrası ---"
	MODE=check status
fi
