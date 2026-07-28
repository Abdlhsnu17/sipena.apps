<?php

return [
    'otp' => [
        'brand_name' => env('OTP_BRAND_NAME', 'SiPeNa'),
        'whatsapp_webhook_url' => env('WHATSAPP_OTP_WEBHOOK_URL'),
        'whatsapp_webhook_token' => env('WHATSAPP_OTP_WEBHOOK_TOKEN'),
        'sms_webhook_url' => env('SMS_OTP_WEBHOOK_URL'),
        'sms_webhook_token' => env('SMS_OTP_WEBHOOK_TOKEN'),
        'expires_in_minutes' => 10,
        'max_attempts' => 5,
    ],

    'email' => [
        'brand_name' => env('EMAIL_BRAND_NAME', 'SiPeNa'),
    ],

    'auth' => [
        'max_failed_login_attempts' => 5,
        'account_lock_duration_minutes' => 15,
    ],

    'usage' => [
        'warning_threshold' => 10,
        'mandatory_check_threshold' => 25,
    ],

    'maintenance' => [
        'sla_at_risk_window_minutes' => 120,
        'automatic_sla_hours_by_priority' => [
            'critical' => 4,
            'high' => 24,
            'normal' => 72,
            'low' => 168,
        ],
    ],
];
