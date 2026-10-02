"""Rigor de la tanda 435 — el CDN de pokemontcg.io, de último recurso.

Romper esto se ve EXACTAMENTE igual que el fallo que viene a arreglar: una
carta en blanco. No hay error, no hay aviso, solo un hueco.
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

E = 'js/escaneo-carta.js'

MUTACIONES = [
    (E, 'McDonalds no se traduce a su nombre',
     "  return m ? `mcd${m[1].slice(2)}` : s", "  return s"),
    (E, 'McDonalds se traduce con el año entero',
     "  return m ? `mcd${m[1].slice(2)}` : s", "  return m ? `mcd${m[1]}` : s"),
    (E, 'el patron de McDonalds se come cualquier cosa',
     "const MCDONALDS = /^(\\d{4})(swsh|sv|sm|xy|bw)$/i", "const MCDONALDS = /^(\\d{4})(\\w*)$/i"),
    (E, 'un set normal se traduce cuando no debe',
     "  const m = s.match(MCDONALDS)", "  const m = ['x', '20'+s.slice(0,2)]"),
    (E, 'una barra en el set se cuela',
     "  if (!s || /[/?#\\s]/.test(s)) return null", "  if (!s) return null"),
    (E, 'la grande y la pequeña son la misma',
     "  return `${POKEMONTCG}/${set}/${n}${calidad === 'high' ? '_hires' : ''}.png`",
     "  return `${POKEMONTCG}/${set}/${n}.png`"),
    (E, 'siempre pide la grande',
     "${calidad === 'high' ? '_hires' : ''}", "_hires"),
    (E, 'una barra en el numero se cuela',
     "  if (!set || !n || /[/?#\\s]/.test(n)) return null", "  if (!set || !n) return null"),
    (E, 'no se llega a pedir nunca',
     "  if (otro) cadena.push(otro)\n", "  \n"),
    (E, 'se cuela por delante de los escaneos oficiales',
     "  const limitless = occidental ? imagenDeLimitless(codigoDeSetDe(carta, codigoDeSet), carta?.local_id) : null\n  if (limitless) cadena.push(limitless)\n  // Y el último sitio (tanda 435), también solo para las occidentales: su\n  // catálogo es el inglés, igual que el de Limitless.\n  const otro = occidental ? imagenDePokemonTCG(carta?.set_id, carta?.local_id, calidad) : null\n  if (otro) cadena.push(otro)",
     "  const otro = occidental ? imagenDePokemonTCG(carta?.set_id, carta?.local_id, calidad) : null\n  if (otro) cadena.push(otro)\n  const limitless = occidental ? imagenDeLimitless(codigoDeSetDe(carta, codigoDeSet), carta?.local_id) : null\n  if (limitless) cadena.push(limitless)"),
    (E, 'se le cuela el arte ingles a una japonesa',
     "  const otro = occidental ? imagenDePokemonTCG(carta?.set_id, carta?.local_id, calidad) : null",
     "  const otro = imagenDePokemonTCG(carta?.set_id, carta?.local_id, calidad)"),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-435.mjs')
