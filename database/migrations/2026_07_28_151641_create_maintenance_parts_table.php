<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('maintenance_parts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('maintenance_id')->constrained('maintenance_records')->cascadeOnDelete();
            $table->string('name');
            $table->decimal('quantity', 12, 2)->default(1);
            $table->string('unit', 50)->nullable();
            $table->decimal('unit_cost', 12, 2)->default(0);
            $table->timestamp('created_at')->useCurrent();

            $table->index('maintenance_id', 'idx_maintenance_parts_record');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('maintenance_parts');
    }
};
