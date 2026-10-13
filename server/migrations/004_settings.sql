CREATE TABLE IF NOT EXISTS settings (
  name       VARCHAR(64)  NOT NULL,
  value      VARCHAR(255) NOT NULL,
  updated_at DATETIME     NOT NULL,
  PRIMARY KEY (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
