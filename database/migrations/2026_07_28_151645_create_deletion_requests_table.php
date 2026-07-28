<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('deletion_requests', function (Blueprint $table) {
            $table->id();
            $table->string('request_code', 50)->nullable();
            $table->string('target_type', 50);
            $table->unsignedBigInteger('target_id');
            $table->string('target_label')->nullable();
            $table->text('reason');
            $table->string('status', 20)->default('pending');
            $table->foreignId('requested_by')->constrained('users')->cascadeOnDelete();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('reviewed_at')->nullable();
            $table->text('review_notes')->nullable();
            $table->dateTime('approved_at')->nullable();
            $table->dateTime('rejected_at')->nullable();
            $table->timestamps();

            $table->index('status', 'idx_deletion_requests_status');
            $table->index(['target_type', 'target_id'], 'idx_deletion_requests_target');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('deletion_requests');
    }
};
