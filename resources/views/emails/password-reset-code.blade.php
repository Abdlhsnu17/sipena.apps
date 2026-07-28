<x-mail::message>
# Kode Verifikasi Reset Password

Halo {{ $name }},

Gunakan kode berikut untuk mereset password akun {{ config('sipena.email.brand_name') }} Anda:

<x-mail::panel>
<div style="font-size: 28px; font-weight: bold; letter-spacing: 6px; text-align: center;">{{ $code }}</div>
</x-mail::panel>

Kode ini berlaku selama {{ $expiresInMinutes }} menit. Jika Anda tidak meminta reset password, abaikan email ini.

Terima kasih,<br>
{{ config('sipena.email.brand_name') }}
</x-mail::message>
