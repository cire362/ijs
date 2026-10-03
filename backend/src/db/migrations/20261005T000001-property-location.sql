ALTER TABLE properties ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
-- DaData qc_geo: 0 exact house, 1 nearest house, 2 street, 3 settlement; manual pins are exact.
ALTER TABLE properties ADD COLUMN IF NOT EXISTS geo_precision SMALLINT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS geocoded_at TIMESTAMPTZ;
DO $$ BEGIN
  ALTER TABLE properties ADD CONSTRAINT properties_coordinates_check CHECK (
    (latitude IS NULL AND longitude IS NULL) OR
    (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS properties_pending_geocode ON properties (id) WHERE latitude IS NULL AND geocoded_at IS NULL;
CREATE INDEX IF NOT EXISTS properties_filters ON properties (region, city, sale_status);
