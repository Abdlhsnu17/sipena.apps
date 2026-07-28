<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('asset_disposal_requests', function (Blueprint $table) {
            $table->id();
            $table->string('request_code', 50)->nullable()->unique('uniq_disposal_code');
            $table->unsignedBigInteger('asset_id');
            $table->string('asset_type', 20)->default('medical');
            $table->string('asset_detail_id', 100)->nullable();
            $table->string('asset_detail_name')->nullable();
            $table->string('asset_detail_code', 100)->nullable();
            $table->text('reason');
            $table->text('condition_notes')->nullable();
            $table->string('status', 30)->default('pending');
            $table->foreignId('requested_by')->constrained('users')->cascadeOnDelete();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('reviewed_at')->nullable();
            $table->text('review_notes')->nullable();
            $table->dateTime('approved_at')->nullable();
            $table->dateTime('rejected_at')->nullable();
            $table->timestamps();

            $table->index(['asset_type', 'asset_id'], 'idx_disposal_asset');
            $table->index('status', 'idx_disposal_status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('asset_disposal_requests');
    }
};
