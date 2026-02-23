-- Migration: Add returned_by to borrowing_records
ALTER TABLE borrowing_records
ADD COLUMN returned_by INT(11) DEFAULT NULL AFTER return_validated_by,
ADD CONSTRAINT fk_borrowing_returned_by FOREIGN KEY (returned_by) REFERENCES users(id) ON DELETE SET NULL;
