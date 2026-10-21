#!/usr/bin/env bash
#
# Açılış Zili — pazar özeti postası (16 Ekim; 17 Ekim'de pazara taşındı).
#
# `/api/cron/haftalik-posta` ucunu `CRON_SECRET` ile çağırır; uç, özeti açan
# ve adresini onaylayan hesaplara geçen haftanın ve bu haftanın özetini
# gönderiyor (app/api/cron/haftalik-posta/route.ts).
#
# Crontab girdisi `deploy/cron-install.sh` ile yazılıyor:
#
#   0 7-11 * * 0 /bin/bash /srv/acilis-zili/current/deploy/cron-weekly-mail.sh
#   0 7 * * 1 /bin/bash /srv/acilis-zili/current/deploy/cron-weekly-mail.sh
#
# PAZAR, SAATTE BİR, BEŞ KEZ. İlk koşu 07:00 UTC = 10:00 TR (Türkiye UTC+3
# sabit, saat kaymaz; ET'de hâlâ pazar). Uç göndermeden önce geçen haftanın
# bilanço gerçekleşenlerini tazeliyor (gerekçe uçta). Sonraki dört koşu
# yalnız eksikleri tamamlar — uç her alıcıyı defterle sahipleniyor,
# giden ikinci kez gitmez; düşen gönderimler sıradaki saatte gider. Uç
# her koşuda önce defteri okuyup gidenleri listeden düşüyor (20 Ekim);
# kimse kalmadıysa tazelemeye bile girmeden `"skipped":"complete"` döner.
#
# GÜNLÜK E-POSTA BÜTÇESİNE TAKILANLAR PAZAR GİTMEZ (20 Ekim): bütçe UTC
# gününe göre, beş koşu aynı günde. 20 Ekim'e kadar burada "sıradaki saatte
# gider" yazıyordu ve yanlıştı. Onları pazartesi 07:00 UTC telafi koşusu
# gönderir (bütçenin en çok yarısıyla — gerekçe uçta); yanıttaki `unsent`
# o gün gidemeyenlerin sayısı, uyarı olarak yazılıyor. Sayı her koşuda
# yalnız defterde satırı OLMAYANLARI sayar: önce bütün listeyi sayıyordu
# ve pazarın sonraki dört koşusu aynı uyarıyı şişkin sayıyla yazıyordu.
#
# Uç tek koşu kilitli: curl'ün zaman aşımı tekrarı ilk koşu sürerken
# gelirse `"skipped":"running"` döner — ilk koşu işi bitiriyor.
#
# Günlük kaydı sessiz: yalnızca hata, uyarı ve gönderim yazılıyor.

set -uo pipefail

ENV_FILE=/etc/acilis-zili.env
ENDPOINT=http://127.0.0.1:3000/api/cron/haftalik-posta

[[ -r "$ENV_FILE" ]] || { logger -t acilis-haftalik -p user.err "ortam dosyasi okunamadi: $ENV_FILE"; exit 1; }

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

[[ -n "${CRON_SECRET:-}" ]] || { logger -t acilis-haftalik -p user.err "CRON_SECRET tanimli degil"; exit 1; }

# Sır argv'de değil, stdin'den — gerekçe deploy/cron-daily.sh.
response=$(curl -sS --max-time 290 --retry 2 --retry-delay 60 --retry-connrefused -w '\n%{http_code}' \
	-H @- \
	"$ENDPOINT" <<<"Authorization: Bearer ${CRON_SECRET}" 2>&1)

status=${response##*$'\n'}
body=${response%$'\n'*}

if [[ "$status" != "200" ]]; then
	logger -t acilis-haftalik -p user.err "basarisiz (http ${status}): ${body:0:400}"
	exit 1
fi
if [[ "$body" == *'"skipped":"running"'* ]]; then
	logger -t acilis-haftalik -p user.info "onceki kosu suruyor, bu cagri atlandi"
fi
if [[ "$body" == *'"unsent":'[1-9]* ]]; then
	logger -t acilis-haftalik -p user.warning "gunluk e-posta butcesi yetmedi, kalanlar bugun gitmez (pazar ise pazartesi 07:00 UTC telafi kosusu dener; kalici cozum EMAIL_DAILY_BUDGET): ${body:0:400}"
fi
if [[ "$body" == *'"sent":'[1-9]* ]]; then
	logger -t acilis-haftalik -p user.info "gonderildi: ${body:0:400}"
fi
