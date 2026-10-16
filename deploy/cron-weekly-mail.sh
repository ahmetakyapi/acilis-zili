#!/usr/bin/env bash
#
# Açılış Zili — pazartesi özeti postası (16 Ekim).
#
# `/api/cron/haftalik-posta` ucunu `CRON_SECRET` ile çağırır; uç, özeti açan
# ve adresini onaylayan hesaplara geçen haftanın ve bu haftanın özetini
# gönderiyor (app/api/cron/haftalik-posta/route.ts).
#
# Crontab girdisi `deploy/cron-install.sh` ile yazılıyor:
#
#   15 11-15 * * 1 /bin/bash /srv/acilis-zili/current/deploy/cron-weekly-mail.sh
#
# PAZARTESİ, SAATTE BİR, BEŞ KEZ. İlk koşu 11:15 UTC = 14:15 TR (gerekçe
# uçta: bilanço gerçekleşenleri 13:30 TR eşitlemesinde doluyor). Sonraki
# dört koşu yalnız eksikleri tamamlar — uç her alıcıyı defterle sahipleniyor,
# giden ikinci kez gitmez; günlük e-posta bütçesine takılanlar ya da
# düşen gönderimler sıradaki saatte gider.
#
# Günlük kaydı sessiz: yalnızca hata ve gönderim yazılıyor.

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
if [[ "$body" == *'"budget":"exhausted"'* ]]; then
	logger -t acilis-haftalik -p user.warning "gunluk e-posta butcesi doldu, kalanlar sonraki saatte: ${body:0:400}"
fi
if [[ "$body" == *'"sent":'[1-9]* ]]; then
	logger -t acilis-haftalik -p user.info "gonderildi: ${body:0:400}"
fi
