<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('maintenance_status_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('maintenance_id')->constrained('maintenance_records')->cascadeOnDelete();
            $table->string('from_status', 20)->nullable();
            $table->string('to_status', 20);
            $table->text('note')->nullable();
            $table->foreignId('changed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['maintenance_id', 'created_at'], 'idx_maintenance_status_logs_record');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('maintenance_status_logs');
    }
};
