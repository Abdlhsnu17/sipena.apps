<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DssWeightPreference extends Model
{
    public $timestamps = false;

    protected $fillable = ['user_id', 'weights_json', 'asset_type', 'updated_at'];

    protected function casts(): array
    {
        return ['updated_at' => 'datetime'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
