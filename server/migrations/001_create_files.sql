CREATE TABLE IF NOT EXISTS files (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id      CHAR(24)        NOT NULL,
  original_name  VARCHAR(255)    NOT NULL,
  stored_name    CHAR(40)        NOT NULL,
  mime_type      VARCHAR(127)    NOT NULL,
  size           BIGINT UNSIGNED NOT NULL,
  owner_hash     CHAR(64)        NOT NULL,
  download_count INT UNSIGNED    NOT NULL DEFAULT 0,
  created_at     DATETIME        NOT NULL,
  expires_at     DATETIME        NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_files_public_id (public_id),
  UNIQUE KEY uq_files_stored_name (stored_name),
  KEY idx_files_owner_created (owner_hash, created_at),
  KEY idx_files_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
