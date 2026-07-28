<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('report_uploads', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('filename');
            $table->string('content_type', 150)->default('application/octet-stream');
            $table->unsignedBigInteger('size_bytes')->default(0);
            $table->string('stored_path')->nullable();
            $table->timestamp('uploaded_at')->useCurrent();
            $table->text('notes')->nullable();
            $table->string('category', 80)->nullable();
            $table->string('related_module', 80)->nullable();
            $table->date('retention_until')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('report_uploads');
    }
};
