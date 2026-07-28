<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class PasswordResetCodeMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public string $name,
        public string $code,
        public int $expiresInMinutes,
    ) {}

    public function envelope(): Envelope
    {
        $brand = config('sipena.email.brand_name');

        return new Envelope(subject: "{$brand}: Kode Verifikasi Reset Password");
    }

    public function content(): Content
    {
        return new Content(markdown: 'emails.password-reset-code');
    }
}
