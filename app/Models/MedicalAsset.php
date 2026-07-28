<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MedicalAsset extends Model
{
    protected $fillable = [
        'asset_code', 'name', 'description', 'category', 'type', 'status', 'condition',
        'location', 'purchase_date', 'purchase_price', 'warranty_expiry', 'specifications', 'image_url',
    ];

    protected function casts(): array
    {
        return [
            'purchase_date' => 'date',
            'warranty_expiry' => 'date',
            'purchase_price' => 'decimal:2',
        ];
    }

    public function getDetailsAttribute(): array
    {
        $specs = json_decode((string) $this->specifications, true);

        return is_array($specs['details'] ?? null) ? $specs['details'] : [];
    }
}
