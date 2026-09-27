CREATE TABLE IF NOT EXISTS dr_account_activity (
  user_id VARCHAR(36) PRIMARY KEY,
  signed_up_at BIGINT NULL,
  last_login_at BIGINT NOT NULL,
  login_count INT NOT NULL DEFAULT 0
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS dr_logins (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  logged_in_at BIGINT NOT NULL,
  INDEX user_login (user_id,id)
) ENGINE=InnoDB;
