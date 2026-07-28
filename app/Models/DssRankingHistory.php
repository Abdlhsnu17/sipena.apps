<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DssRankingHistory extends Model
{
    public $timestamps = false;

    protected $table = 'dss_ranking_history';

    protected $fillable = [
        'user_id', 'asset_type', 'weights_json', 'pairwise_matrix_json', 'criteria_json',
        'total_alternatives', 'top_rankings_json', 'generated_at', 'created_at',
    ];

    protected function casts(): array
    {
        return [
            'generated_at' => 'datetime',
            'created_at' => 'datetime',
            'total_alternatives' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
