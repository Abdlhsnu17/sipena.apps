<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('maintenance_attachments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('maintenance_id')->constrained('maintenance_records')->cascadeOnDelete();
            $table->string('file_name');
            $table->string('file_path', 500);
            $table->string('mime_type', 100)->nullable();
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('created_at')->useCurrent();

            $table->index('maintenance_id', 'idx_maintenance_attachments_record');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('maintenance_attachments');
    }
};
