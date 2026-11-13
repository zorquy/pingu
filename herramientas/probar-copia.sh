#!/usr/bin/env bash
#
# Restaurar una copia en un Postgres de prueba y comprobar que sirve (tanda
# 1313, S10). Una copia que nunca se ha restaurado no se sabe si vale.
#
#   PGURL_PRUEBA='postgresql://…/prueba' ./herramientas/probar-copia.sh pokedoc-<fecha>.sql.gz [auth-users.sql]
#
# El segundo fichero (opcional) es la ESTRUCTURA de auth.users
# (`pg_dump --schema-only --table=auth.users`): sin ella se crea una mínima y
# las filas de las cuentas no entran (pero el resto se comprueba igual).
#
# Lo que comprueba: que las tablas que importan tienen, restauradas, las
# mismas filas que el volcado dice traer. Los errores de roles y de
# extensiones de Supabase son normales en un Postgres pelado y no cuentan.
set -euo pipefail

COPIA="${1:?Falta el fichero de la copia}"
AUTH_SQL="${2:-}"
: "${PGURL_PRUEBA:?Falta PGURL_PRUEBA (la base de prueba, que se vacía)}"

echo "Preparando la base de prueba…"
psql "$PGURL_PRUEBA" -q -v ON_ERROR_STOP=1 <<'SQL'
drop schema if exists public cascade;
create schema public;
drop schema if exists auth cascade;
create schema auth;
do $$ begin create role anon; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
do $$ begin create role service_role; exception when duplicate_object then null; end $$;
create or replace function auth.uid() returns uuid language sql stable as $f$ select null::uuid $f$;
create or replace function auth.role() returns text language sql stable as $f$ select null::text $f$;
create or replace function auth.jwt() returns jsonb language sql stable as $f$ select '{}'::jsonb $f$;
SQL
if [ -n "$AUTH_SQL" ] && [ -s "$AUTH_SQL" ]; then
  # Solo la tabla: sus claves ajenas a otras tablas de auth no hacen falta.
  grep -v "FOREIGN KEY\|REFERENCES auth\.\(identities\|sessions\|mfa\)" "$AUTH_SQL" | psql "$PGURL_PRUEBA" -q >/dev/null 2>&1 || true
fi
psql "$PGURL_PRUEBA" -q -c "create table if not exists auth.users (id uuid primary key);" >/dev/null

echo "Restaurando…"
gunzip -c "$COPIA" | psql "$PGURL_PRUEBA" -q >/dev/null 2>"${TMPDIR:-/tmp}/restaurar.log" || true
echo "  ($(grep -c ERROR "${TMPDIR:-/tmp}/restaurar.log" || true) errores de la restauración; los de roles y extensiones son normales)"

echo "Comparando filas…"
MAL=0
for t in public.guides public.user_profiles public.forum_threads public.forum_posts public.user_collection public.tcg_cards public.tcg_sets auth.users; do
  esperadas=$(gunzip -c "$COPIA" | awk -v t="$t" '
    index($0, "COPY " t " ") == 1 { dentro=1; next }
    dentro && $0 == "\\." { dentro=0 }
    dentro { n++ }
    END { print n+0 }')
  hay=$(psql "$PGURL_PRUEBA" -Atc "select count(*) from $t" 2>/dev/null || echo "falta")
  if [ "$t" = auth.users ] && [ -z "$AUTH_SQL" ]; then
    printf "  %-24s %s en la copia (sin su estructura no se restaura aquí)\n" "$t" "$esperadas"
    continue
  fi
  if [ "$hay" = "$esperadas" ]; then
    printf "  %-24s %s ✓\n" "$t" "$hay"
  else
    printf "  %-24s %s restauradas de %s ✗\n" "$t" "$hay" "$esperadas"
    MAL=1
  fi
done
if [ "$MAL" = 1 ]; then
  echo "La copia NO se restaura entera. Mira ${TMPDIR:-/tmp}/restaurar.log." >&2
  exit 1
fi
echo "La copia se restaura y cuadra."
