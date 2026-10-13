-- Admins sign in with a username instead of an email, so email becomes optional.
ALTER TABLE users
  MODIFY email VARCHAR(254) NULL,
  ADD COLUMN username VARCHAR(50) NULL AFTER email,
  ADD COLUMN is_admin TINYINT(1) NOT NULL DEFAULT 0 AFTER password_hash,
  ADD UNIQUE KEY uq_users_username (username);
