#!/usr/bin/env python3
"""Update allow-listed app variables in /etc/acilis-zili.env.

Değerler stdin'den JSON olarak gelir ({"AD": "değer"}), argv'den asla.
Yalnız aşağıdaki listedeki anahtarlar yazılır; listede olmayan ya da biçimi
tutmayan bir değer gelirse dosyaya HİÇ dokunulmaz (hepsi ya da hiçbiri).
Listede olup JSON'da olmayan anahtar sunucudaki hâliyle kalır — GitHub'da
tanımlanmamış secret mevcut değeri silmez (15 Ekim, deploy/sync-app-env.sh).
"""
import grp
import json
import os
from pathlib import Path
import re
import sys
import tempfile

# Ad → değer biçimi. Tırnak, ters bölü, $, ters tırnak ve satır sonu hiçbir
# biçimde yok: değer systemd EnvironmentFile'da çift tırnak içinde duruyor
# ve satır sonu yeni bir değişken enjekte etmenin tek yolu.
ALLOWED = {
    "RESEND_API_KEY": re.compile(r"re_[A-Za-z0-9_]{8,128}"),
    # "Ad <adres@alan>" ya da çıplak adres; Türkçe harfler serbest.
    "EMAIL_FROM": re.compile(r"(?:[^\"\\$`<>\r\n]{1,80} )?<?[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}>?"),
    "VAPID_PUBLIC_KEY": re.compile(r"[A-Za-z0-9_-]{40,128}"),
    "VAPID_PRIVATE_KEY": re.compile(r"[A-Za-z0-9_-]{20,128}"),
    "VAPID_SUBJECT": re.compile(r"(?:mailto:[^\s\"\\$`]{3,200}|https://[^\s\"\\$`]{3,200})"),
}


def _line(name):
    return re.compile(rf"^\s*(?:export\s+)?{name}\s*=")


def validate(values):
    if not isinstance(values, dict) or not values:
        raise ValueError("Expected a non-empty JSON object")
    clean = {}
    for name, raw in values.items():
        if name not in ALLOWED or not isinstance(raw, str):
            raise ValueError("Variable not allowed")
        value = raw.strip()
        if not ALLOWED[name].fullmatch(value):
            raise ValueError("Invalid value format")
        clean[name] = value
    return clean


def update_env(path: Path, values, *, uid=None, gid=None):
    clean = validate(values)
    if path.is_symlink() or not path.is_file():
        raise ValueError("Environment file must be an existing regular file")
    original = path.stat()
    updated = []
    written = set()
    for line in path.read_text(encoding="utf-8").splitlines():
        name = next((n for n in clean if _line(n).match(line)), None)
        if name is None:
            updated.append(line)
        elif name not in written:
            updated.append(f'{name}="{clean[name]}"')
            written.add(name)
    for name in clean:
        if name not in written:
            updated.append(f'{name}="{clean[name]}"')
    fd, temporary = tempfile.mkstemp(prefix=".acilis-env-", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as output:
            os.fchmod(output.fileno(), 0o640)
            os.fchown(output.fileno(), original.st_uid if uid is None else uid,
                      original.st_gid if gid is None else gid)
            output.write("\n".join(updated) + "\n")
            output.flush()
            os.fsync(output.fileno())
        os.replace(temporary, path)
        directory = os.open(path.parent, os.O_RDONLY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
    # Değeri ya da özetini basmadan doğrula.
    lines = path.read_text(encoding="utf-8").splitlines()
    for name, value in clean.items():
        if [line for line in lines if _line(name).match(line)] != [f'{name}="{value}"']:
            raise RuntimeError("Verification failed")
    return sorted(clean)


if __name__ == "__main__":
    try:
        if os.geteuid() != 0:
            raise PermissionError("Root required")
        names = update_env(Path("/etc/acilis-zili.env"), json.loads(sys.stdin.read(8192)),
                           uid=0, gid=grp.getgrnam("acilis").gr_gid)
    except Exception:
        print("App env update failed; credential content was not logged.", file=sys.stderr)
        sys.exit(1)
    print("Updated: " + ", ".join(names) + " (values not logged).")
