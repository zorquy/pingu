"""Rigor de la tanda 621 — /laboratorio, la puerta propia del laboratorio."""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

PAG = 'js/laboratorio-pagina.js'

MUTACIONES = [
    (PAG, 'un mazo corto se abre igual', "  if (n < 13) return showToast(", "  if (false) return showToast("),
    (PAG, '«Probar» abre otro mazo', "  const m = mazos.find((x) => x.id === id) || (await cargarMazo(id).catch(() => null))", "  const m = mazos[0] || (await cargarMazo(id).catch(() => null))"),
    (PAG, 'el borrador no sale', "  const borrador = b && (!b.id || b.cambiado)", "  const borrador = false && b"),
    (PAG, 'entrar no vuelve aquí', "href=\"/auth.html?volver=${encodeURIComponent('/laboratorio')}\"", "href=\"/auth.html\""),
    (PAG, 'un fallo al leer se dice como «no tienes»', "    caja.innerHTML = `${borrador ? `<ul class=\"lp-mazos\">${borrador}</ul>` : ''}<p class=\"lp-error\">", "    mazos = []\n    caja.innerHTML = `<p class=\"subtext\">Todavía no tienes mazos guardados.</p><p hidden>"),
    (PAG, 'las líneas que no encuentra se callan', "      if (fuera.length) {", "      if (false) {"),
    (PAG, '?mazo= no se lee', "  } else if (q.get('mazo')) probarMazo(q.get('mazo'))", "  } else if (false) probarMazo(q.get('mazo'))"),
    (PAG, '«otros» sale como un mazo', ".filter((f) => f.arquetipo !== ARQUETIPO_OTROS)", ""),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-621.mjs')
