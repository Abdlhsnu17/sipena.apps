<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    use HasFactory, Notifiable, SoftDeletes;

    public const ROLE_ADMIN = 'admin';
    public const ROLE_LEADER = 'leader';
    public const ROLE_STAFF = 'staff';
    public const ROLE_STAFF_PJ = 'staff_pj';
    public const ROLE_TEKNISI = 'teknisi';
    public const ROLE_USER = 'user';

    protected $fillable = [
        'nip',
        'name',
        'email',
        'password',
        'role',
        'staff_access_type',
        'gender',
        'work_unit',
        'sub_work_unit',
        'home_address',
        'phone_number',
        'photo_path',
        'last_login',
        'session_version',
        'uml_access',
        'is_active',
        'account_status',
        'must_change_password',
        'failed_login_attempts',
        'locked_until',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'last_login' => 'datetime',
            'locked_until' => 'datetime',
            'session_version' => 'integer',
            'uml_access' => 'boolean',
            'is_active' => 'boolean',
            'must_change_password' => 'boolean',
            'failed_login_attempts' => 'integer',
        ];
    }

    public function hasAnyRole(array $roles): bool
    {
        return in_array($this->role, $roles, true);
    }

    public function isAdmin(): bool
    {
        return $this->role === self::ROLE_ADMIN;
    }

    public function visibleMenus(): array
    {
        return app(\App\Services\AccessControlService::class)->visibleMenusFor($this);
    }
}
