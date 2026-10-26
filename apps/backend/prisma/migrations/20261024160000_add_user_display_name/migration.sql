-- Keep firstname and lastname intact and populate Better Auth's native name field.
ALTER TABLE "user" ADD COLUMN "name" TEXT;
UPDATE "user" SET "name" = btrim(btrim("firstname") || ' ' || btrim("lastname"));
ALTER TABLE "user" ALTER COLUMN "name" SET NOT NULL;

-- Derive the display name from the final row, including concurrent partial updates.
CREATE FUNCTION sync_user_display_name() RETURNS trigger AS $$
BEGIN
  NEW."name" := btrim(btrim(NEW."firstname") || ' ' || btrim(NEW."lastname"));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_display_name
BEFORE INSERT OR UPDATE OF "firstname", "lastname", "name" ON "user"
FOR EACH ROW EXECUTE FUNCTION sync_user_display_name();
