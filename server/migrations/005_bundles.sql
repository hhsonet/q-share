CREATE TABLE IF NOT EXISTS bundles (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id  CHAR(24)        NOT NULL,
  name       VARCHAR(120)    NULL,
  owner_hash CHAR(64)        NOT NULL,
  is_public  TINYINT(1)      NOT NULL DEFAULT 1,
  user_id    BIGINT UNSIGNED NULL,
  created_at DATETIME        NOT NULL,
  expires_at DATETIME        NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_bundles_public_id (public_id),
  KEY idx_bundles_owner (owner_hash, created_at),
  KEY idx_bundles_user (user_id, created_at),
  KEY idx_bundles_public (is_public, created_at),
  KEY idx_bundles_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE files
  ADD COLUMN bundle_id BIGINT UNSIGNED NULL AFTER user_id,
  ADD KEY idx_files_bundle (bundle_id);
