"""Rigor de la tanda 629 — las energías especiales, bien traducidas, y la
lista de una repetición con varias impresiones de una carta.

Cada mutación rompe el ORIGEN: la corrección del nombre, la cuenta por
nombre de la lista, el motor o la migración."""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

TX = 'js/texto.js'
CS = 'js/catalogo-series.js'
LI = 'js/repeticiones/lista.js'
PA = 'js/constructor/partida.js'
NO = 'js/constructor/nombres.js'
CD = 'netlify/lib/carta-detalle.mjs'
SQL = 'supabase-migration-nombres-energias.sql'

MUTACIONES = [
    # ── El nombre ──
    (TX, 'el tipo de una energía va como sustantivo (Psíquico)', "Psychic: 'Psíquica', Fighting: 'Lucha', Darkness: 'Oscura', Metal: 'Metálica'", "Psychic: 'Psíquico', Fighting: 'Lucha', Darkness: 'Oscuro', Metal: 'Metal'"),
    (TX, 'los Amuletos Hada se quedan en inglés', "    .replace(AMULETO_CON_TIPO, (m, a, t) => `${a} ${TIPO_SUSTANTIVO[t]}`)\n", ""),
    (CS, 'la ficha enseña el nombre de TCGdex tal cual', "  const es = typeof carta?.name_es === 'string' ? corregirNombreEs(carta.name_es.trim()) : ''", "  const es = typeof carta?.name_es === 'string' ? carta.name_es.trim() : ''"),
    (CS, 'el español guardado en `name` no se corrige', "  return corregirNombreEs(propio) || en || es || ''", "  return propio || en || es || ''"),

    # ── La lista de una repetición ──
    (LI, 'el registro y la lista solo casan con el nombre de TCGdex', ".flatMap((n) => [n, corregirNombreEs(n)])", ".flatMap((n) => [n])"),
    (LI, 'solo cuenta la primera impresión de un nombre', "    if (es.length && copiasDe(es) >= v.copias) continue", "    if (es.length && es[0].n >= v.copias) continue"),
    (LI, '«sin ver» solo descuenta de la primera impresión', "    const fila = (porNombre.get(plano(nombre)) || []).find((f) => f.n > 0)", "    const fila = (porNombre.get(plano(nombre)) || [])[0]"),

    # ── El motor ──
    (NO, 'las energías con el tipo traducido se quedan sin efecto', "  if (m) INGLES_DE[`energia ${TIPO_EN_ESPANOL[m[1]]}${m[2]}`] = en\n", ""),
    (PA, 'la Magnética no da {M}', "    case 'magnetic metal energy': return [['M']]\n", ""),
    (PA, 'la Magnética no quita la retirada', "    if (esDeTipo(c, 'M') && slot.energias.some((u) => claveDeEfecto(this.carta(u)) === 'magnetic metal energy')) return 0\n", ""),
    (PA, 'la Magnética quita la retirada a cualquiera', "    if (esDeTipo(c, 'M') && slot.energias.some((u) => claveDeEfecto(this.carta(u)) === 'magnetic metal energy')) return 0", "    if (slot.energias.some((u) => claveDeEfecto(this.carta(u)) === 'magnetic metal energy')) return 0"),
    (PA, 'la Fuego Nitro se queda en el descarte', "      this.s.mano.push(u)\n      this.log('La Energía Fuego Nitro vuelve a tu mano.')", "      this.s.descarte.push(u)\n      this.log('La Energía Fuego Nitro vuelve a tu mano.')"),

    # ── Lo que llega de TCGdex ──
    (CD, 'el nombre de TCGdex entra sin corregir', "  return encontrado?.nombre && encontrado.idioma !== 'en' ? corregirNombreEs(encontrado.nombre) : null", "  return encontrado?.nombre && encontrado.idioma !== 'en' ? encontrado.nombre : null"),

    # ── La migración ──
    (SQL, 'la migración no toca `name`', "update public.tcg_cards c\n   set name = regexp_replace(", "update public.tcg_cards c\n   set name = name || regexp_replace("),
    (SQL, 'el símbolo con barra «\\[W\\]» se queda', "   set name_en = regexp_replace(c.name_en, '\\\\?\\[' || t.letra || '\\\\?\\]', t.en, 'g')", "   set name_en = regexp_replace(c.name_en, '\\[' || t.letra || '\\]', t.en, 'g')"),
    (SQL, 'la telepática se queda sin nombre inglés', "update public.tcg_cards set name_en = 'Telepathic Psychic Energy'", "update public.tcg_cards set name_en = null"),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-629.mjs')
