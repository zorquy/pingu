#!/usr/bin/env bash
#
# Copia de las IMÁGENES subidas (portadas de guías, avatares, fotos del foro).
#
# La copia de la base NO las lleva dentro: en la base solo están las
# direcciones. Si se perdiera el almacenamiento, restaurarías todas las guías
# con las imágenes rotas.
#
# Esto saca del volcado todas las direcciones del almacenamiento de Supabase
# y se las baja. No hace falta ninguna clave: ese bucket es público, que es
# justo lo que hace que las imágenes se vean en la web.
#
# ── Cómo se usa ──
#
#   ./herramientas/copia-imagenes.sh ~/copias-pokedoc/pokedoc-2026-08-18-1249.sql.gz
#
# Las imágenes se guardan al lado del volcado, en una carpeta con el mismo
# nombre. Volver a ejecutarlo NO se baja lo que ya está: solo lo nuevo.
set -euo pipefail

VOLCADO="${1:-}"
if [ -z "$VOLCADO" ] || [ ! -f "$VOLCADO" ]; then
  echo "Uso: $0 <fichero .sql.gz de copia-seguridad.sh>" >&2
  exit 1
fi

DESTINO="${VOLCADO%.sql.gz}-imagenes"
mkdir -p "$DESTINO"

leer() {
  case "$VOLCADO" in
    *.gz) gunzip -c "$VOLCADO" ;;
    *) cat "$VOLCADO" ;;
  esac
}

# Las direcciones aparecen dentro del texto de las guías y en columnas como
# cover_image o avatar_url. Se sacan todas, se quitan los duplicados y se
# limpian los caracteres con los que el volcado las deja pegadas.
# [:space:] y no un espacio a secas: dentro del volcado las columnas van
# separadas por TABULADORES, y con un espacio la dirección se llevaba por
# delante el resto de la línea.
URLS=$(leer | grep -oE 'https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/[^"'"'"'[:space:]\\)<>]+' | sed 's/[.,;]*$//' | sort -u)

TOTAL=$(printf '%s\n' "$URLS" | grep -c . || true)
if [ "$TOTAL" -eq 0 ]; then
  echo "No hay ninguna imagen subida en este volcado."
  exit 0
fi

echo "$TOTAL imágenes referenciadas. Bajando a $DESTINO…"
BAJADAS=0
SALTADAS=0
FALLOS=0
while IFS= read -r url; do
  [ -n "$url" ] || continue
  # Se conserva la ruta de dentro del bucket (usuario/fichero.jpg), que es
  # lo que hace falta para volver a subirlas al mismo sitio.
  RUTA="${url#*/object/public/}"
  SALIDA="$DESTINO/$RUTA"
  if [ -s "$SALIDA" ]; then
    SALTADAS=$((SALTADAS + 1))
    continue
  fi
  mkdir -p "$(dirname "$SALIDA")"
  if curl -fsS --max-time 60 -o "$SALIDA" "$url"; then
    BAJADAS=$((BAJADAS + 1))
  else
    FALLOS=$((FALLOS + 1))
    rm -f "$SALIDA"
    echo "  no se ha podido bajar: $url" >&2
  fi
done <<< "$URLS"

echo "Bajadas $BAJADAS · ya estaban $SALTADAS · fallos $FALLOS"
[ "$FALLOS" -eq 0 ] || exit 1
