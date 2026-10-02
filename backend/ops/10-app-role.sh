#!/bin/sh
set -eu
case "$APP_DB_USER" in
  ''|*[!a-z0-9_]*|postgres) printf 'Invalid APP_DB_USER\n' >&2; exit 1 ;;
esac
if [ "${#APP_DB_PASSWORD}" -lt 16 ]; then printf 'APP_DB_PASSWORD must be generated and at least 16 characters\n' >&2; exit 1; fi
psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --set=ON_ERROR_STOP=1 --set=app_user="$APP_DB_USER" --set=app_database="$POSTGRES_DB" <<'SQL'
\getenv app_password APP_DB_PASSWORD
SELECT format('CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD %L', :'app_user', :'app_password') \gexec
SELECT format('ALTER DATABASE %I OWNER TO %I', :'app_database', :'app_user') \gexec
SELECT format('ALTER SCHEMA public OWNER TO %I', :'app_user') \gexec
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
SQL
