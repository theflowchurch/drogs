-- Wrong passwords in a row (17 Nov): after five the account waits for a password reset.
CREATE TABLE IF NOT EXISTS dr_login_failures (
  user_id VARCHAR(36) PRIMARY KEY,
  failures INT NOT NULL DEFAULT 0,
  updated_at BIGINT NOT NULL
) ENGINE=InnoDB
