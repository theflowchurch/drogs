-- Fallback image store used when the object storage credentials are unavailable.
CREATE TABLE IF NOT EXISTS dr_media_blobs (
  object_key VARCHAR(512) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  data LONGBLOB NOT NULL
) ENGINE=InnoDB;
