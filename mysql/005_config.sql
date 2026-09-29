-- Office-managed settings (mail, payments, storage) that override environment variables.
CREATE TABLE IF NOT EXISTS dr_config (
  name VARCHAR(64) PRIMARY KEY, value TEXT NOT NULL, updated_at BIGINT NOT NULL
) ENGINE=InnoDB;
