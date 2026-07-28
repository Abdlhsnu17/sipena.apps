<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Role extends Model
{
    protected $fillable = ['code', 'name', 'description'];

    public function menus(): BelongsToMany
    {
        return $this->belongsToMany(Menu::class, 'role_menu_permissions')->withPivot('created_at');
    }
}
