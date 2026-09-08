#!/usr/bin/env bash
#
# Açılış Zili — sunucuda sürüm güncelleme.
#
#   sudo -u acilis /srv/acilis-zili/deploy/update.sh
#
# Sırayla: kaynağı çek, bağımlılıkları eşitle, derle, servisi yeniden başlat,
# gerçekten ayağa kalktığını doğrula.

set -euo pipefail

APP_DIR=/srv/acilis-zili
ENV_FILE=/etc/acilis-zili.env

cd "$APP_DIR"

# ORTAM DEĞİŞKENLERİ DERLEME ZAMANINDA GEREKLİ — çalışma zamanında değil.
# `NEXT_PUBLIC_SITE_URL` demete gömülüyor; `SITE_INDEXABLE` ise `robots.ts`
# ve `sitemap.ts` statik üretildiği için o çıktıya pişiyor. İkisi de yalnızca
# systemd'nin EnvironmentFile'ında dursaydı derleme onları göremez ve site
# `localhost:3000` adresli bir site haritasıyla yayına çıkardı.
set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

echo "==> kaynak"
git pull --ff-only

echo "==> bagimliliklar"
npm ci

# `.next` bilerek siliniyor: rota tipleri (`PageProps`, `RouteContext`) oraya
# üretiliyor ve eski bir çıktının üstüne derlemek Next 16'da tip çakışması
# veriyor. Temizlemek birkaç saniye, teşhisi yarım saat.
echo "==> derleme"
rm -rf .next
npm run build

echo "==> servis"
sudo systemctl restart acilis-zili

echo "==> saglik"
for i in $(seq 1 30); do
	if curl -sf -o /dev/null http://127.0.0.1:3000/; then
		echo "ayakta (${i}. deneme)"
		exit 0
	fi
	sleep 2
done

echo "AYAGA KALKMADI - gunluk:" >&2
journalctl -u acilis-zili -n 40 --no-pager >&2
exit 1
