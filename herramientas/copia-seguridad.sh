#!/usr/bin/env bash
#
# Copia de seguridad de la base de PokeDoc.
#
# ESTO SE EJECUTA EN TU MÁQUINA, NO EN LA WEB. Descarga una copia completa
# de la base a un fichero comprimido, y después comprueba que ese fichero
# tiene dentro lo que tiene que tener.
#
# Antes de abrir al público conviene tener una copia reciente y, sobre todo,
# haber comprobado UNA VEZ que se puede restaurar. Una copia que nunca se ha
# restaurado no es una copia: es un fichero.
#
# ── Cómo se usa ──
#
#   1. Copia la cadena de conexión de Supabase:
#      Panel de Supabase → Project Settings → Database → Connection string →
#      pestaña "URI". Es algo así:
#        postgresql://postgres.xxxx:CONTRASEÑA@aws-0-eu-west-3.pooler.supabase.com:5432/postgres
#
#   2. Ejecuta:
#        PGURL='esa-cadena' ./herramientas/copia-seguridad.sh
#
#      O, si prefieres no dejarla en el historial del terminal:
#        read -rs PGURL && export PGURL
#        ./herramientas/copia-seguridad.sh
#
#   3. Guarda el fichero resultante FUERA de este ordenador (disco externo,
#      Drive, lo que sea). Una copia que vive en el mismo sitio que el
#      original no protege de casi nada.
#
# La cadena lleva la contraseña de la base: no se escribe en ningún fichero
# del proyecto, no se sube a GitHub y no hace falta que salga de tu máquina.
set -euo pipefail

DESTINO="${DESTINO:-$HOME/copias-pokedoc}"
FECHA="$(date +%Y-%m-%d-%H%M)"
FICHERO="$DESTINO/pokedoc-$FECHA.sql.gz"

if [ -z "${PGURL:-}" ]; then
  echo "Falta PGURL (la cadena de conexión de Supabase). Mira las instrucciones de arriba." >&2
  exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "No tienes pg_dump instalado." >&2
  echo "  macOS:  brew install libpq && brew link --force libpq" >&2
  echo "  Ubuntu: sudo apt install postgresql-client" >&2
  exit 1
fi

# La versión de pg_dump tiene que ser IGUAL O MÁS NUEVA que la del servidor.
# Si es más vieja, se planta con "server version mismatch" — y eso es mejor
# que una copia a medias, así que no se fuerza nada.
mkdir -p "$DESTINO"

echo "Descargando la base…"
# Son DOS volcados seguidos dentro del mismo fichero, y tiene que ser así:
#
#   1. El esquema `public` entero (tablas, datos, funciones, políticas). Es
#      todo PokeDoc.
#   2. Los DATOS de `auth.users`, que es donde viven las cuentas. Sin eso
#      tendrías las guías y los mensajes, pero de nadie.
#
# `auth` va aparte y solo con los datos porque esa tabla la crea Supabase en
# cada proyecto: al restaurar hay que meter las filas en la que ya existe, no
# volver a crearla. Y no vale poner `--schema=public --table=auth.users` en
# la misma orden: con `--table`, pg_dump se olvida del esquema entero y copia
# solo esa tabla (probado: salía una copia con las cuentas y nada más).
#
# --no-owner y --no-privileges: los dueños y los permisos son de este
# proyecto de Supabase concreto. Sin eso, restaurar en otro proyecto se
# llena de errores de roles que allí no existen.
{
  pg_dump "$PGURL" --no-owner --no-privileges --schema=public --format=plain
  echo
  echo "-- ── Cuentas (auth.users) ──"
  pg_dump "$PGURL" --no-owner --no-privileges --table=auth.users --data-only --format=plain
} | gzip -9 > "$FICHERO"

TAMANO=$(du -h "$FICHERO" | cut -f1)
echo "Copia guardada en $FICHERO ($TAMANO)"

# ── Comprobación ──
#
# Un fichero que se ha creado no es lo mismo que una copia buena. Aquí se
# mira DENTRO: que estén las tablas que importan y que traigan filas.
echo
echo "Comprobando lo que hay dentro…"
TABLAS="guides categories user_profiles forum_threads forum_posts guide_comments achievements tcg_cards users"
FALTAN=""
for t in $TABLAS; do
  # `COPY <tabla> (` es como pg_dump escribe cada volcado de datos.
  if gunzip -c "$FICHERO" | grep -qE "^COPY (public|auth)\.$t "; then
    FILAS=$(gunzip -c "$FICHERO" | awk -v t="$t" '
      $0 ~ "^COPY (public|auth)\\." t " " { dentro=1; next }
      dentro && $0 == "\\." { dentro=0 }
      dentro { n++ }
      END { print n+0 }')
    printf "  %-16s %s %s\n" "$t" "$FILAS" "$([ "$FILAS" = 1 ] && echo fila || echo filas)"
  else
    FALTAN="$FALTAN $t"
  fi
done

if [ -n "$FALTAN" ]; then
  echo
  echo "AVISO: no aparecen en la copia:$FALTAN" >&2
  echo "Si alguna de esas tablas existe en la base, la copia está incompleta." >&2
  exit 1
fi

echo
echo "La copia tiene dentro todas las tablas que se esperaban."
echo "Acuérdate de: 1) sacarla de este ordenador, y 2) probar a restaurarla"
echo "alguna vez (ver herramientas/COPIA-DE-SEGURIDAD.md)."
