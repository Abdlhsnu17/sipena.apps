<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('nip', 20)->unique();
            $table->string('name');
            $table->string('email')->unique();
            $table->string('password');
            $table->string('role', 20)->default('staff');
            $table->string('staff_access_type', 20)->nullable();
            $table->string('gender', 20)->nullable();
            $table->string('work_unit')->nullable();
            $table->string('sub_work_unit')->nullable();
            $table->string('home_address', 500)->nullable();
            $table->string('phone_number', 25)->nullable();
            $table->string('photo_path')->nullable();
            $table->timestamps();
            $table->timestamp('last_login')->nullable();
            $table->integer('session_version')->default(0);
            $table->boolean('uml_access')->default(false);
            $table->boolean('is_active')->default(true);
            $table->string('account_status', 20)->default('active');
            $table->boolean('must_change_password')->default(false);
            $table->integer('failed_login_attempts')->default(0);
            $table->timestamp('locked_until')->nullable();
            $table->timestamp('deleted_at')->nullable();
            $table->foreignId('deleted_by')->nullable();
            $table->text('delete_reason')->nullable();
        });

        Schema::create('sessions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->foreignId('user_id')->nullable()->index();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->longText('payload');
            $table->integer('last_activity')->index();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('users');
        Schema::dropIfExists('sessions');
    }
};
