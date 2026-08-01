#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

info(){ printf '\033[1;34m[AI Business OS]\033[0m %s\n' "$*"; }
warn(){ printf '\033[1;33m[UYARI]\033[0m %s\n' "$*"; }
fail(){ printf '\033[1;31m[HATA]\033[0m %s\n' "$*" >&2; exit 1; }

command -v git >/dev/null 2>&1 || fail "Git bulunamadı. Önce Xcode Command Line Tools kurulmalı."
command -v python3 >/dev/null 2>&1 || fail "Python 3 bulunamadı."

info "Kurulum kontrolü başlıyor…"

if [[ ! -f .env.local ]]; then
  cp .env.example .env.local
  warn ".env.local oluşturuldu. Supabase ve n8n bilgileri daha sonra güvenli biçimde doldurulmalı."
else
  info ".env.local zaten mevcut; dokunulmadı."
fi

[[ -f command-center/index.html ]] || fail "command-center/index.html eksik."
[[ -f supabase/schema.sql ]] || fail "supabase/schema.sql eksik."
[[ -f n8n/ai-business-os-router.json ]] || fail "n8n workflow dosyası eksik."

mkdir -p runtime/logs runtime/backups

cat > runtime/START-HERE.txt <<'TXT'
AI BUSINESS OPERATING SYSTEM

1. Ön izleme:
   python3 -m http.server 8080 --directory command-center
   Safari: http://localhost:8080

2. Supabase:
   supabase/schema.sql dosyasını yeni Supabase projesinin SQL Editor bölümünde çalıştır.

3. n8n:
   n8n/ai-business-os-router.json dosyasını Import from File ile içe aktar.

4. Güvenlik:
   Gerçek API anahtarlarını yalnız .env.local içine yaz. GitHub'a gönderme.
TXT

info "Dosya yapısı doğrulandı."
info "Yerel ön izleme başlatılıyor: http://localhost:8080"
info "Durdurmak için Terminal'de Control + C kullan."
exec python3 -m http.server 8080 --directory command-center
