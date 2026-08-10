# PostgreSQL Migration Guide

The app runs on SQLite by default. Switching to PostgreSQL for production takes three steps.

---

## 1. Install the driver

Uncomment in `requirements.txt`:

```
psycopg2-binary==2.9.9
```

Then reinstall:

```powershell
pip install -r requirements.txt
```

---

## 2. Set the connection string

In your `.env` (or hosting environment variables):

```env
DATABASE_URL=postgresql://user:password@localhost:5432/aicj
```

Replace `user`, `password`, and `aicj` with your actual credentials and database name.

---

## 3. Run migrations

Flask-Migrate (Alembic) is already wired in. On first deploy:

```powershell
# Initialise the migrations folder (only once)
flask --app backend.app db init

# Generate the first migration from your models
flask --app backend.app db migrate -m "initial schema"

# Apply it
flask --app backend.app db upgrade
```

After any model change:

```powershell
flask --app backend.app db migrate -m "describe your change"
flask --app backend.app db upgrade
```

To roll back one revision:

```powershell
flask --app backend.app db downgrade
```

---

## Notes

- The `DATABASE_URL` environment variable is the single source of truth for both SQLite and PostgreSQL. No code changes are needed to switch.
- In production, never commit `.env` — inject secrets via your hosting provider's environment variable panel.
- For local PostgreSQL development you can use Docker:

```powershell
docker run --name aicj-db -e POSTGRES_PASSWORD=secret -e POSTGRES_DB=aicj -p 5432:5432 -d postgres:16
```

Then set:

```env
DATABASE_URL=postgresql://postgres:secret@localhost:5432/aicj
```
