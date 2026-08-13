#!/bin/sh

set -eu

restore_terminal() {
  stty echo 2>/dev/null || true
}

trap restore_terminal EXIT HUP INT TERM

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
ENV_FILE="$ROOT_DIR/docker/.env"
COMPOSE_FILE="$ROOT_DIR/docker/compose.yml"

mkdir -p "$(dirname "$ENV_FILE")"
touch "$ENV_FILE"
chmod 600 "$ENV_FILE"

get_env_value() {
  key=$1
  awk -F= -v key="$key" '$1 == key { sub(/^[^=]*=/, ""); print; exit }' "$ENV_FILE"
}

set_env_value() {
  key=$1
  value=$2
  temporary_file="${ENV_FILE}.tmp.$$"

  awk -F= -v key="$key" '$1 != key { print }' "$ENV_FILE" > "$temporary_file"
  printf '%s=%s\n' "$key" "$value" >> "$temporary_file"
  mv "$temporary_file" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
}

prompt_value() {
  label=$1
  key=$2
  current=$(get_env_value "$key")

  if [ -n "$current" ]; then
    printf '%s sudah terisi. Tekan Enter untuk mempertahankan, atau isi nilai baru:\n> ' "$label"
  else
    printf '%s:\n> ' "$label"
  fi

  IFS= read -r entered
  if [ -n "$entered" ]; then
    set_env_value "$key" "$entered"
  fi
}

prompt_secret() {
  label=$1
  key=$2
  current=$(get_env_value "$key")

  if [ -n "$current" ]; then
    printf '%s sudah terisi. Tekan Enter untuk mempertahankan, atau isi nilai baru:\n> ' "$label"
  else
    printf '%s (input disembunyikan):\n> ' "$label"
  fi

  stty -echo
  IFS= read -r entered
  stty echo
  printf '\n'
  if [ -n "$entered" ]; then
    set_env_value "$key" "$entered"
  fi
}

prompt_url() {
  label=$1
  key=$2
  current=$(get_env_value "$key")

  while true; do
    if [ -n "$current" ]; then
      printf '%s sudah terisi. Tekan Enter untuk mempertahankan, atau isi nilai baru:\n> ' "$label"
    else
      printf '%s (kosongkan bila belum ada):\n> ' "$label"
    fi

    IFS= read -r entered
    if [ -z "$entered" ]; then
      return
    fi

    case "$entered" in
      http://*|https://*)
        set_env_value "$key" "$entered"
        return
        ;;
      *)
        printf '\nNilai tidak valid: "%s". URL webhook harus diawali http:// atau https:// (bukan nomor HP/angka). Coba lagi.\n' "$entered" >&2
        ;;
    esac
  done
}

set_env_value NODE_ENV "$(get_env_value NODE_ENV || true)"
if [ -z "$(get_env_value NODE_ENV)" ]; then set_env_value NODE_ENV development; fi
set_env_value OTP_BRAND_NAME "$(get_env_value OTP_BRAND_NAME || true)"
if [ -z "$(get_env_value OTP_BRAND_NAME)" ]; then set_env_value OTP_BRAND_NAME SiPeNa; fi

printf '\nKonfigurasi Twilio Verify (kanal OTP utama, kosongkan untuk melewati)\n'
prompt_value 'Twilio Account SID (ACxxxx)' TWILIO_ACCOUNT_SID
prompt_secret 'Twilio Auth Token' TWILIO_AUTH_TOKEN
prompt_value 'Twilio Verify Service SID (VAxxxx)' TWILIO_VERIFY_SERVICE_SID
prompt_value 'Channel Twilio Verify (sms/whatsapp)' TWILIO_VERIFY_CHANNEL
if [ -z "$(get_env_value TWILIO_VERIFY_CHANNEL)" ]; then set_env_value TWILIO_VERIFY_CHANNEL sms; fi

printf '\nKonfigurasi WhatsApp OTP\n'
prompt_url 'Webhook URL WhatsApp dari provider' WHATSAPP_OTP_WEBHOOK_URL
prompt_secret 'Token webhook WhatsApp' WHATSAPP_OTP_WEBHOOK_TOKEN

printf '\nKonfigurasi SMS OTP\n'
prompt_url 'Webhook URL SMS dari provider' SMS_OTP_WEBHOOK_URL
prompt_secret 'Token webhook SMS' SMS_OTP_WEBHOOK_TOKEN

printf '\nKonfigurasi Gmail SMTP\n'
set_env_value SMTP_HOST smtp.gmail.com
set_env_value SMTP_PORT 465
set_env_value SMTP_SECURE true
prompt_value 'Alamat Gmail pengirim' SMTP_USER
prompt_secret 'Google App Password' SMTP_PASS

smtp_user=$(get_env_value SMTP_USER)
if [ -n "$smtp_user" ]; then
  set_env_value SMTP_FROM "$smtp_user"
  set_env_value EMAIL_FROM "$smtp_user"
fi
set_env_value EMAIL_BRAND_NAME SiPeNa

whatsapp_url=$(get_env_value WHATSAPP_OTP_WEBHOOK_URL)
sms_url=$(get_env_value SMS_OTP_WEBHOOK_URL)
smtp_pass=$(get_env_value SMTP_PASS)

validate_webhook_url() {
  label=$1
  value=$2
  if [ -n "$value" ]; then
    case "$value" in
      http://*|https://*) ;;
      *)
        printf '\n%s tidak valid. URL harus diawali http:// atau https://.\n' "$label" >&2
        exit 1
        ;;
    esac
  fi
}

validate_webhook_url 'Webhook WhatsApp' "$whatsapp_url"
validate_webhook_url 'Webhook SMS' "$sms_url"

twilio_account_sid=$(get_env_value TWILIO_ACCOUNT_SID)
twilio_auth_token=$(get_env_value TWILIO_AUTH_TOKEN)
twilio_service_sid=$(get_env_value TWILIO_VERIFY_SERVICE_SID)
twilio_ready=''
if [ -n "$twilio_account_sid" ] && [ -n "$twilio_auth_token" ] && [ -n "$twilio_service_sid" ]; then
  twilio_ready='yes'
fi

if [ -z "$twilio_ready" ] && [ -z "$whatsapp_url" ] && [ -z "$sms_url" ] && { [ -z "$smtp_user" ] || [ -z "$smtp_pass" ]; }; then
  printf '\nTidak ada kanal pengiriman yang lengkap. Konfigurasi disimpan, tetapi backend tidak dibuat ulang.\n' >&2
  exit 1
fi

printf '\nMembuat ulang backend dengan konfigurasi baru...\n'
docker compose -f "$COMPOSE_FILE" up -d --force-recreate backend

printf '\nStatus konfigurasi di container:\n'
docker inspect sipena-apps-backend-1 --format '{{range .Config.Env}}{{println .}}{{end}}' |
  awk -F= '/^(TWILIO_ACCOUNT_SID|TWILIO_AUTH_TOKEN|TWILIO_VERIFY_SERVICE_SID|TWILIO_VERIFY_CHANNEL|WHATSAPP_OTP_WEBHOOK_URL|WHATSAPP_OTP_WEBHOOK_TOKEN|SMS_OTP_WEBHOOK_URL|SMS_OTP_WEBHOOK_TOKEN|SMTP_HOST|SMTP_USER|SMTP_PASS|SMTP_FROM|EMAIL_FROM)=/ {
    value=substr($0,index($0,"=")+1)
    print $1 "=" (value == "" ? "<empty>" : "<set>")
  }'

printf '\nSelesai. Rahasia tersimpan hanya di docker/.env dan tidak ditampilkan.\n'
