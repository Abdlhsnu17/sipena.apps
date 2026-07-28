<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('maintenance_records', function (Blueprint $table) {
            $table->id();
            $table->string('maintenance_code', 50)->unique('uq_maintenance_code');
            $table->unsignedBigInteger('asset_id');
            $table->string('asset_type', 20)->default('medical');
            $table->string('asset_detail_id', 100)->nullable();
            $table->string('asset_detail_name')->nullable();
            $table->string('asset_detail_code', 100)->nullable();
            $table->string('type', 50);
            $table->string('priority', 20)->default('normal');
            $table->string('status', 20)->default('requested');
            $table->dateTime('scheduled_date');
            $table->dateTime('due_at')->nullable();
            $table->dateTime('started_at')->nullable();
            $table->dateTime('completed_date')->nullable();
            $table->text('description');
            $table->string('technician')->nullable();
            $table->foreignId('technician_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('vendor_name')->nullable();
            $table->string('vendor_reference', 100)->nullable();
            $table->date('warranty_until')->nullable();
            $table->integer('estimated_duration_minutes')->nullable();
            $table->decimal('estimated_cost', 12, 2)->nullable();
            $table->string('damage_photo_url', 500)->nullable();
            $table->string('before_photo_url', 500)->nullable();
            $table->string('after_photo_url', 500)->nullable();
            $table->text('diagnosis')->nullable();
            $table->text('action_taken')->nullable();
            $table->text('checklist')->nullable();
            $table->text('spare_parts')->nullable();
            $table->text('verification_result')->nullable();
            $table->string('final_condition')->nullable();
            $table->text('verification_notes')->nullable();
            $table->date('next_maintenance_date')->nullable();
            $table->dateTime('actual_start_at')->nullable();
            $table->dateTime('actual_end_at')->nullable();
            $table->string('recurrence_interval', 20)->default('none');
            $table->boolean('recurrence_enabled')->default(false);
            $table->string('approval_status', 20)->default('not_required');
            $table->text('approval_notes')->nullable();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('approved_at')->nullable();
            $table->dateTime('reminder_h7_sent_at')->nullable();
            $table->dateTime('reminder_h3_sent_at')->nullable();
            $table->dateTime('reminder_h1_sent_at')->nullable();
            $table->decimal('cost', 10, 2)->nullable();
            $table->text('notes')->nullable();
            $table->text('cancellation_reason')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('completed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('validated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('validated_at')->nullable();
            $table->timestamps();
            $table->timestamp('deleted_at')->nullable();
            $table->foreignId('deleted_by')->nullable();
            $table->text('delete_reason')->nullable();

            $table->index('asset_id', 'idx_maintenance_asset');
            $table->index('asset_type', 'idx_maintenance_asset_type');
            $table->index(['priority', 'due_at'], 'idx_maintenance_priority_due');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('maintenance_records');
    }
};
