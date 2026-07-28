<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('maintenance_history', function (Blueprint $table) {
            $table->id();
            $table->foreignId('maintenance_id')->constrained('maintenance_records')->cascadeOnDelete();
            $table->unsignedBigInteger('asset_id');
            $table->string('type', 50);
            $table->string('status', 20)->default('requested');
            $table->dateTime('scheduled_date');
            $table->dateTime('started_date')->nullable();
            $table->dateTime('completed_date')->nullable();
            $table->text('description');
            $table->string('technician')->nullable();
            $table->decimal('cost', 12, 2)->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('validated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('validated_at')->nullable();
            $table->timestamps();
            $table->timestamp('deleted_at')->nullable();
            $table->foreignId('deleted_by')->nullable();
            $table->text('delete_reason')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('maintenance_history');
    }
};
