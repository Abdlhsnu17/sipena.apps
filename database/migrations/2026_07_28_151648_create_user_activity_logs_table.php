<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_activity_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('feature', 100);
            $table->string('action', 100);
            $table->text('description')->nullable();
            $table->text('metadata_json')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['user_id', 'created_at'], 'idx_user_activity_user_created');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_activity_logs');
    }
};
