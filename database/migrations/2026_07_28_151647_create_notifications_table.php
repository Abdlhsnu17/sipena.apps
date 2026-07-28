<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('type', 50);
            $table->string('category', 30)->default('system');
            $table->string('title');
            $table->text('message')->nullable();
            $table->string('link')->nullable();
            $table->string('reference_type', 50)->nullable();
            $table->unsignedBigInteger('reference_id')->nullable();
            $table->boolean('is_read')->default(false);
            $table->dateTime('read_at')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['user_id', 'is_read', 'created_at'], 'idx_notifications_user_read_created');
            $table->index(['reference_type', 'reference_id'], 'idx_notifications_reference');
            $table->index('category', 'idx_notifications_category');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notifications');
    }
};
