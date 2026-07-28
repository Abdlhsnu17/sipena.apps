<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dss_ranking_history', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('asset_type', 20)->default('all');
            $table->text('weights_json');
            $table->text('pairwise_matrix_json')->nullable();
            $table->text('criteria_json');
            $table->integer('total_alternatives')->default(0);
            $table->text('top_rankings_json')->nullable();
            $table->timestamp('generated_at');
            $table->timestamp('created_at')->useCurrent();

            $table->index(['user_id', 'created_at'], 'idx_dss_ranking_history_user_created');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dss_ranking_history');
    }
};
