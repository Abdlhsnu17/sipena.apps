<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('borrowing_records', function (Blueprint $table) {
            $table->id();
            $table->string('borrowing_code', 50)->unique('uq_borrowing_code');
            $table->unsignedBigInteger('asset_id');
            $table->string('asset_type', 20)->default('medical');
            $table->string('asset_detail_id', 100)->nullable();
            $table->string('asset_detail_name')->nullable();
            $table->string('asset_detail_code', 100)->nullable();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('borrower_position', 100)->nullable();
            $table->string('borrower_work_unit', 150)->nullable();
            $table->foreignId('owner_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('owner_name', 150)->nullable();
            $table->string('owner_nip', 30)->nullable();
            $table->string('owner_position', 100)->nullable();
            $table->string('owner_work_unit', 150)->nullable();
            $table->dateTime('borrow_date');
            $table->dateTime('due_date')->nullable();
            $table->dateTime('return_date')->nullable();
            $table->string('status', 20)->default('pending');
            $table->text('purpose')->nullable();
            $table->string('purpose_type', 30)->nullable();
            $table->string('destination_room')->nullable();
            $table->integer('loan_duration_value')->nullable();
            $table->string('loan_duration_unit', 20)->nullable();
            $table->integer('quantity')->default(1);
            $table->text('notes')->nullable();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('approved_at')->nullable();
            $table->foreignId('rejected_by')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('rejected_at')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->string('return_condition', 20)->nullable();
            $table->text('return_notes')->nullable();
            $table->foreignId('return_validated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('return_validated_at')->nullable();
            $table->foreignId('returned_by')->nullable()->constrained('users')->nullOnDelete();
            $table->integer('overdue_days')->default(0);
            $table->string('sanction_status', 20)->default('none');
            $table->text('sanction_notes')->nullable();
            $table->dateTime('sanction_applied_at')->nullable();
            $table->integer('extension_count')->default(0);
            $table->dateTime('last_extended_date')->nullable();
            $table->text('extension_notes')->nullable();
            $table->boolean('is_extension_blocked')->default(false);
            $table->dateTime('resolved_at')->nullable();
            $table->foreignId('resolved_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('resolved_notes')->nullable();
            $table->timestamps();
            $table->timestamp('deleted_at')->nullable();
            $table->foreignId('deleted_by')->nullable();
            $table->text('delete_reason')->nullable();

            $table->index('asset_id', 'idx_borrowing_asset');
            $table->index('asset_type', 'idx_borrowing_asset_type');
            $table->index('sanction_status', 'idx_borrowing_sanction_status');
            $table->index(['user_id', 'status', 'sanction_status'], 'idx_user_overdue_status');
            $table->index(['user_id', 'sanction_status', 'is_extension_blocked'], 'idx_user_extension_status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('borrowing_records');
    }
};
