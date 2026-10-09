#!/usr/bin/env bash
#
# Açılış Zili — uygulama kullanıcısının crontab'ını tamamlar (9 Ekim).
#
# update.sh her sürümde YENİ sürümün kopyasıyla çağırıyor; eksik satırı
# ekliyor, var olanlara dokunmuyor. bootstrap.sh crontab'ı ilk kurulumda
# baştan yazıyordu (`crontab -`, eskisini siler) ve tek satırlıktı: ikinci
# bir iş eklemek ya sunucuya elle girmek ya da bootstrap'ı yeniden koşmak
# demekti. Artık satırların listesi burada ve dağıtım onu kendisi uyguluyor.
#
# `bash` öneki: depoda exec biti güvenilir değil (bkz. bootstrap.sh).

set -euo pipefail

APP_ROOT=/srv/acilis-zili
LINES=(
	"30 10 * * 1-5 /bin/bash $APP_ROOT/current/deploy/cron-daily.sh"
	"*/5 * * * * /bin/bash $APP_ROOT/current/deploy/cron-alerts.sh"
)

current=$(crontab -l 2>/dev/null || true)
next="$current"
# `CRON_TZ=UTC` ŞART ve en üstte: altındaki her satırın saati UTC
# (gerekçe cron-daily.sh).
if ! grep -qxF "CRON_TZ=UTC" <<<"$next"; then
	next=$(printf 'CRON_TZ=UTC\n%s' "$next")
fi
for line in "${LINES[@]}"; do
	grep -qxF "$line" <<<"$next" || next=$(printf '%s\n%s' "$next" "$line")
done

if [[ "$next" != "$current" ]]; then
	printf '%s\n' "$next" | sed '/^$/d' | crontab -
	echo "crontab güncellendi"
else
	echo "crontab güncel"
fi
