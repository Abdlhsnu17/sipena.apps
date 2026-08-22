-- Logo global yang dipakai bersama oleh halaman login dan sidebar.
-- Nilai berupa path publik; file khusus admin disimpan di uploads/branding.
INSERT IGNORE INTO `app_settings` (`setting_key`, `setting_value`) VALUES
  ('brand_logo', '/images/logo-sipena-transparent.png');
