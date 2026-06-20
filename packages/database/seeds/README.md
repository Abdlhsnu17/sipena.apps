# Database Seeds

This folder stores the local schema seed for SIPENA. Database migrations are stored one level above in `packages/database/migrations`.

- `schema.sql`: local schema dump for `sipena_db_local`
- `../migrations/`: migration scripts for schema changes after the seed was created

## Local MySQL + phpMyAdmin

The canonical seed schema for `sipena_db_local` lives in `packages/database/seeds/schema.sql`. To use it with a local MySQL + phpMyAdmin stack:

1. From the repo root run `docker compose up -d mysql phpmyadmin`.
   * The compose file will start MySQL (`sipena_db_local`) on the private Docker network and phpMyAdmin on `localhost:8081`. The default credentials are `root` / `root_changeme`.
   * If you plan to connect the backend container to this MySQL container, use `DB_HOST=mysql`, `DB_PORT=3306`, `DB_USER=sipena_app`, and `DB_PASSWORD=changeme`.
2. Open `http://localhost:8081`, log in as `root` and import `packages/database/seeds/schema.sql` into the `sipena_db_local` database.
3. Run migration scripts from `packages/database/migrations` after pulling backend changes that add new columns.

Current migrations include:

- `20260427_add_borrowing_sanctions.sql`
- `20260517_add_borrowing_extension_columns.sql`
- `20260517_add_user_security_columns.sql`
- `20260523_add_asset_usage_logs.sql`
- `20260523_add_user_sub_work_unit.sql`
- `20260524_add_asset_usage_no.sql`
- `20260524_link_asset_usage_borrowings.sql`
- `20260528_add_user_access_control_columns.sql`

Once the schema is imported, backend containers can use `mysql:3306` / `sipena_db_local`. For host-side CLI access, run commands through the container with `docker compose exec mysql ...` or add a local-only compose override that publishes a free host port.
