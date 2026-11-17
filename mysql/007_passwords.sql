-- Members sign in with email and password; a code by email is only for resetting it.
CREATE TABLE IF NOT EXISTS dr_passwords (
  user_id VARCHAR(36) PRIMARY KEY,
  password_hash VARCHAR(255) NOT NULL,
  updated_at BIGINT NOT NULL
) ENGINE=InnoDB
