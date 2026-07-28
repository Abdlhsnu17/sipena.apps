<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('asset_usage_logs', function (Blueprint $table) {
            $table->id();
            $table->string('no', 50)->nullable()->unique('uniq_asset_usage_no');
            $table->unsignedBigInteger('borrowing_id')->nullable();
            $table->unsignedBigInteger('asset_id');
            $table->string('asset_type', 20)->default('medical');
            $table->string('asset_detail_id', 100)->nullable();
            $table->string('asset_detail_name')->nullable();
            $table->string('asset_detail_code', 100)->nullable();
            $table->string('asset_location')->nullable();
            $table->string('room_name');
            $table->foreignId('operator_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('usage_context', 30)->default('own_room');
            $table->dateTime('started_at');
            $table->dateTime('ended_at')->nullable();
            $table->integer('usage_count')->default(1);
            $table->string('condition_before', 50)->nullable();
            $table->string('condition_after', 50)->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->timestamps();
            $table->timestamp('deleted_at')->nullable();
            $table->foreignId('deleted_by')->nullable();
            $table->text('delete_reason')->nullable();
            $table->string('source_type', 20)->default('manual');

            $table->index('borrowing_id', 'idx_asset_usage_borrowing');
            $table->index(['asset_type', 'asset_id', 'asset_detail_id'], 'idx_asset_usage_asset');
            $table->index(['room_name', 'started_at'], 'idx_asset_usage_room_started');
            $table->index('deleted_at', 'idx_asset_usage_deleted_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('asset_usage_logs');
    }
};
