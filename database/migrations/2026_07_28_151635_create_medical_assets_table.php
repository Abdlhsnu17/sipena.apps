<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('medical_assets', function (Blueprint $table) {
            $table->id();
            $table->string('asset_code', 50)->unique();
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('category', 100);
            $table->string('type', 20)->default('medical');
            $table->string('status', 20)->default('available');
            $table->string('condition', 20)->default('good');
            $table->string('location')->nullable();
            $table->date('purchase_date')->nullable();
            $table->decimal('purchase_price', 12, 2)->nullable();
            $table->date('warranty_expiry')->nullable();
            $table->text('specifications')->nullable();
            $table->string('image_url', 500)->nullable();
            $table->timestamps();

            $table->index('type', 'idx_medical_type');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('medical_assets');
    }
};
