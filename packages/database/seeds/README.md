# Database

This package stores database artifacts for the inventory system.

- `schema.sql`: local schema dump
- `migrations/`: migration scripts
- `seeds/`: seed data

## Local MySQL + phpMyAdmin

The canonical schema for `sipena_db_local` lives in `schema.sql`. To use it with a local MySQL + phpMyAdmin stack:

1. From the repo root run `docker compose -f packages/backend/docker-compose.yml up mysql phpmyadmin`.
   * The compose file will start MySQL (`sipena_db_local`) and phpMyAdmin on `localhost:8081`. The default credentials are `root` / `root`.
   * If you plan to connect the backend to this container, make sure `packages/backend/.env` sets `DB_PASSWORD=root` (the file defaults to an empty password for a local install).
2. Open `http://localhost:8081`, log in as `root` and import `packages/db/schema.sql` into the `sipena_db_local` database.
3. Optionally import `packages/db/seeds/sipena_db_local.sql` whenever you need a documented copy of the schema plus seed data for phpMyAdmin/backup purposes.

Once the schema is imported, you can point the backend or any CLI tool to `localhost:3306` / `sipena_db_local` and interact with the tables defined above.
