<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Menu extends Model
{
    protected $fillable = ['code', 'label', 'path', 'sort_order'];

    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(Role::class, 'role_menu_permissions')->withPivot('created_at');
    }
}
