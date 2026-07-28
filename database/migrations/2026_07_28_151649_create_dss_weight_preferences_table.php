<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dss_weight_preferences', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->text('weights_json');
            $table->string('asset_type', 20)->default('all');
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();

            $table->unique('user_id', 'uniq_dss_weight_preferences_user');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dss_weight_preferences');
    }
};
