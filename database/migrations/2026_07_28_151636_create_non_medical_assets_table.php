<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('non_medical_assets', function (Blueprint $table) {
            $table->id();
            $table->string('asset_code', 50)->unique();
            $table->string('name');
            $table->string('category', 100);
            $table->string('brand', 100)->nullable();
            $table->string('model', 100)->nullable();
            $table->string('serial_number', 100)->nullable();
            $table->date('purchase_date')->nullable();
            $table->date('warranty_expiry')->nullable();
            $table->string('location')->nullable();
            $table->text('specifications')->nullable();
            $table->string('status', 20)->default('available');
            $table->string('condition', 20)->default('good');
            $table->string('usage_purpose', 100)->default('Operasional Bersama');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('condition', 'idx_non_medical_condition');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('non_medical_assets');
    }
};
