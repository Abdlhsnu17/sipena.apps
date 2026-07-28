<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class NonMedicalAsset extends Model
{
    protected $fillable = [
        'asset_code', 'name', 'category', 'brand', 'model', 'serial_number', 'purchase_date',
        'warranty_expiry', 'location', 'specifications', 'status', 'condition', 'usage_purpose', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'purchase_date' => 'date',
            'warranty_expiry' => 'date',
        ];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function getDetailsAttribute(): array
    {
        $specs = json_decode((string) $this->specifications, true);

        return is_array($specs['details'] ?? null) ? $specs['details'] : [];
    }
}
