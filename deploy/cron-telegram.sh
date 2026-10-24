#!/usr/bin/env bash
#
# Açılış Zili — Telegram kanalı (24 Ekim).
#
# `/api/cron/telegram` ucunu `CRON_SECRET` ile çağırır; uç "şimdi
# gönderilecek ne var" diye bakan bir durum makinesi (açılış öncesi bülten
# ve takvim, kapanış, yeni Mercek, büyük makro veri — gerekçe
# app/api/cron/telegram/route.ts ve lib/telegram.ts).
#
# Crontab girdisi `deploy/cron-install.sh` ile yazılıyor:
#
#   */5 * * * * /bin/bash /srv/acilis-zili/current/deploy/cron-telegram.sh
#
# HER BEŞ DAKİKADA, HER GÜN — alarm taramasıyla aynı gerekçe
# (cron-alerts.sh): açılış ve kapanış yaz saatiyle UTC'de kayıyor, tatiller
# takvimde; pencereyi uç seansın kendi saatinden hesaplıyor.
#
# Günlük kaydı SESSİZ: yalnızca hata, gönderim ve günde bir kez "kapalı"
# (belirteç ya da kanal tanımlı değilse uç `"skipped":"off"` döner; her
# koşuda yazmak günde 288 satır olurdu).

set -uo pipefail

ENV_FILE=/etc/acilis-zili.env
ENDPOINT=http://127.0.0.1:3000/api/cron/telegram

[[ -r "$ENV_FILE" ]] || { logger -t acilis-telegram -p user.err "ortam dosyasi okunamadi: $ENV_FILE"; exit 1; }

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

[[ -n "${CRON_SECRET:-}" ]] || { logger -t acilis-telegram -p user.err "CRON_SECRET tanimli degil"; exit 1; }

# Sır argv'de değil, stdin'den — gerekçe deploy/cron-daily.sh.
response=$(curl -sS --max-time 90 -w '\n%{http_code}' \
	-H @- \
	"$ENDPOINT" <<<"Authorization: Bearer ${CRON_SECRET}" 2>&1)

status=${response##*$'\n'}
body=${response%$'\n'*}

if [[ "$status" != "200" ]]; then
	logger -t acilis-telegram -p user.err "basarisiz (http ${status}): ${body:0:400}"
	exit 1
fi
if [[ "$body" == *'"skipped":"off"'* ]]; then
	# Günde bir kez (00:00–00:04 UTC koşusu): kanal kapalı.
	[[ $(date -u +%H%M) < 0005 ]] && logger -t acilis-telegram -p user.info "kapali: TELEGRAM_BOT_TOKEN ya da TELEGRAM_CHANNEL_ID tanimli degil"
	exit 0
fi
# Defter tablosu yok = HİÇ gönderilmiyor (migration uygulanmamış). Sorun bu
# kez sessiz kalmamalı: her koşuda uyarı.
if [[ "$body" == *'"skipped":"no-ledger"'* ]]; then
	logger -t acilis-telegram -p user.warning "telegram_posts tablosu yok, gonderim durdu (npm run db:migrate): ${body:0:200}"
	exit 0
fi
if [[ "$body" == *'"sent":'[1-9]* ]]; then
	logger -t acilis-telegram -p user.info "gonderildi: ${body:0:400}"
fi
if [[ "$body" == *'"failed":'[1-9]* ]]; then
	logger -t acilis-telegram -p user.warning "gonderilemedi, sonraki kosuda yeniden denenecek: ${body:0:400}"
fi
# Zaman aşımı / ağ hatası: teslim edilmiş olabilir, tekrar denenmez (route.ts → deliver).
if [[ "$body" == *'"unknown":'[1-9]* ]]; then
	logger -t acilis-telegram -p user.warning "sonuc belirsiz (zaman asimi), tekrar denenmeyecek; kanali kontrol et: ${body:0:400}"
fi
