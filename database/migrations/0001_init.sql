
CREATE TABLE IF NOT EXISTS admins (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(64) NOT NULL,
  display_name VARCHAR(120) NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_admin_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS sessions (
  id CHAR(64) PRIMARY KEY, -- SHA-256 del token de sesión
  admin_id INT UNSIGNED NOT NULL,
  csrf_token CHAR(64) NOT NULL,
  ip VARCHAR(64) NULL,
  user_agent VARCHAR(255) NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sessions_admin FOREIGN KEY (admin_id) REFERENCES admins (id) ON DELETE CASCADE,
  INDEX idx_sessions_admin (admin_id),
  INDEX idx_sessions_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS settings (
  setting_key VARCHAR(64) PRIMARY KEY,
  setting_value VARCHAR(500) NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS events (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(140) NOT NULL,
  description VARCHAR(500) NULL,
  status ENUM('draft','active','closed','archived') NOT NULL DEFAULT 'active',
  is_current TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_events_current (is_current),
  INDEX idx_events_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS cars (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  model VARCHAR(120) NULL,
  color VARCHAR(40) NULL,
  image_url VARCHAR(500) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_car_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS races (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  event_id INT UNSIGNED NOT NULL,
  race_number INT UNSIGNED NOT NULL,
  status ENUM('pending','open','running','finished','cancelled') NOT NULL DEFAULT 'open',
  is_active TINYINT(1) NOT NULL DEFAULT 0, 
  winner_lane TINYINT UNSIGNED NULL,
  finished_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_race_event_number (event_id, race_number),
  INDEX idx_races_event (event_id, status),
  INDEX idx_races_active (is_active),
  CONSTRAINT fk_races_event FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reservations (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  race_id INT UNSIGNED NOT NULL,
  lane TINYINT UNSIGNED NOT NULL,
  car_id INT UNSIGNED NOT NULL,
  participant_name VARCHAR(120) NOT NULL,
  contact VARCHAR(160) NOT NULL,
  status ENUM('pending_payment','confirmed','expired','cancelled') NOT NULL DEFAULT 'pending_payment',
  token CHAR(32) NOT NULL,
  expires_at DATETIME NOT NULL,
  confirmed_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  lane_key VARCHAR(40) GENERATED ALWAYS AS (
    IF(status IN ('pending_payment','confirmed'), CONCAT(race_id, ':', lane), NULL)
  ) STORED,
  car_key VARCHAR(40) GENERATED ALWAYS AS (
    IF(status IN ('pending_payment','confirmed'), CONCAT(race_id, ':', car_id), NULL)
  ) STORED,
  UNIQUE KEY uq_res_token (token),
  UNIQUE KEY uq_res_lane (lane_key),
  UNIQUE KEY uq_res_car (car_key),
  INDEX idx_res_race (race_id, status),
  INDEX idx_res_expiry (status, expires_at),
  CONSTRAINT fk_res_race FOREIGN KEY (race_id) REFERENCES races (id),
  CONSTRAINT fk_res_car FOREIGN KEY (car_id) REFERENCES cars (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS payments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  reservation_id INT UNSIGNED NOT NULL,
  method ENUM('transfer','cash','other') NOT NULL DEFAULT 'transfer',
  amount DECIMAL(10,2) NULL,
  reference VARCHAR(160) NULL,
  status ENUM('pending','confirmed','rejected') NOT NULL DEFAULT 'confirmed',
  confirmed_by INT UNSIGNED NULL,
  confirmed_at DATETIME NULL,
  note VARCHAR(300) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_pay_res (reservation_id),
  CONSTRAINT fk_pay_res FOREIGN KEY (reservation_id) REFERENCES reservations (id),
  CONSTRAINT fk_pay_admin FOREIGN KEY (confirmed_by) REFERENCES admins (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS race_results (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  race_id INT UNSIGNED NOT NULL,
  lane TINYINT UNSIGNED NOT NULL,
  car_id INT UNSIGNED NOT NULL,
  reservation_id INT UNSIGNED NOT NULL,
  position TINYINT UNSIGNED NOT NULL DEFAULT 1,
  is_winner TINYINT(1) NOT NULL DEFAULT 1,
  recorded_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_result_race_lane (race_id, lane),
  INDEX idx_results_race (race_id),

  CONSTRAINT fk_results_race FOREIGN KEY (race_id) REFERENCES races (id),
  CONSTRAINT fk_results_car FOREIGN KEY (car_id) REFERENCES cars (id),
  CONSTRAINT fk_results_res FOREIGN KEY (reservation_id) REFERENCES reservations (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  admin_id INT UNSIGNED NULL,
  action VARCHAR(80) NOT NULL,
  entity VARCHAR(40) NULL,
  entity_id INT UNSIGNED NULL,
  details JSON NULL,
  ip VARCHAR(64) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_action (action),
  INDEX idx_audit_created (created_at),
  CONSTRAINT fk_audit_admin FOREIGN KEY (admin_id) REFERENCES admins (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


INSERT INTO settings (setting_key, setting_value) VALUES
  ('whatsapp_number', ''),
  ('reservation_expiry_minutes', '30'),
  ('entry_price', '100'),
  ('stream_poll_ms', '2000'),
  ('admin_poll_ms', '4000'),
  ('availability_poll_ms', '5000')
ON DUPLICATE KEY UPDATE setting_key = setting_key;
