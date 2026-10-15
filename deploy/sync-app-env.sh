#!/usr/bin/env bash
# GitHub runner only. Uygulama ortamındaki izinli anahtarları (e-posta, Web
# Push) GitHub Secrets'tan sunucuya yazar — set-app-env.py'nin listesi.
# Yalnız TANIMLI secret'lar gider; boş olan sunucudaki değere dokunmaz.
# Değerler şifreli stdin'den JSON olarak akar, komut satırına düşmez.
#
#   RESTART=0  servisi yeniden başlatma (deploy.yml: update.sh zaten başlatıyor)
set -euo pipefail
set +x
: "${SSH_KEY:?SSH key is required}"
: "${HOST:?VPS host is required}"
[[ "$HOST" =~ ^[a-zA-Z0-9.-]+$ ]] || { echo 'Invalid VPS host' >&2; exit 1; }

payload=$(python3 - <<'PY'
import json, os
names = ["RESEND_API_KEY", "EMAIL_FROM", "VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT"]
print(json.dumps({n: os.environ[n] for n in names if os.environ.get(n, "").strip()}))
PY
)
if [[ "$payload" == "{}" ]]; then
  echo 'No app env secrets defined; server environment left as is.'
  exit 0
fi

umask 077
key_file=$(mktemp)
trap 'rm -f "$key_file"' EXIT
printf '%s\n' "$SSH_KEY" > "$key_file"
script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
remote_command=$(python3 - "$script_dir/set-app-env.py" <<'PY'
import pathlib, shlex, sys
print("sudo -n python3 -c " + shlex.quote(pathlib.Path(sys.argv[1]).read_text()))
PY
)
# Host anahtarı sabitlemesi — gerekçe deploy.yml (15 Ekim).
ssh_args=(-i "$key_file" -o BatchMode=yes -o "StrictHostKeyChecking=${strict:-accept-new}" -o ConnectTimeout=15 "ubuntu@$HOST")
printf '%s' "$payload" | ssh "${ssh_args[@]}" "$remote_command"
if [[ "${RESTART:-1}" != "0" ]]; then
  ssh "${ssh_args[@]}" 'sudo -n systemctl restart acilis-zili && sudo -n systemctl is-active --quiet acilis-zili'
  echo 'App env synced; application service is active.'
fi
