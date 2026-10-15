#!/usr/bin/env bash
# GitHub runner only. Pass secrets through stdin, not remote command arguments.
set -euo pipefail
set +x
: "${SSH_KEY:?SSH key is required}"
: "${HOST:?VPS host is required}"
: "${CLAUDE_ANALYSIS_API_KEY:?Analysis key is required}"
[[ "$HOST" =~ ^[a-zA-Z0-9.-]+$ ]] || { echo 'Invalid VPS host' >&2; exit 1; }
umask 077
key_file=$(mktemp)
trap 'rm -f "$key_file"' EXIT
printf '%s\n' "$SSH_KEY" > "$key_file"
script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
# The command contains only helper source code. The API key goes over encrypted stdin.
remote_command=$(python3 - "$script_dir/set-analysis-key.py" <<'PY'
import pathlib, shlex, sys
print("sudo -n python3 -c " + shlex.quote(pathlib.Path(sys.argv[1]).read_text()))
PY
)
# Host anahtarı sabitlemesi: iş akışı VPS_HOST_KEY'i known_hosts'a yazıp
# `strict=yes` veriyorsa yalnız o anahtar kabul edilir (gerekçe deploy.yml,
# 15 Ekim). Değişken tanımlı değilse eski accept-new davranışı sürer.
ssh_args=(-i "$key_file" -o BatchMode=yes -o "StrictHostKeyChecking=${strict:-accept-new}" -o ConnectTimeout=15 "ubuntu@$HOST")
printf '%s' "$CLAUDE_ANALYSIS_API_KEY" | ssh "${ssh_args[@]}" "$remote_command"
ssh "${ssh_args[@]}" 'sudo -n systemctl restart acilis-zili && sudo -n systemctl is-active --quiet acilis-zili'
echo 'Analysis secret synced; application service is active.'
