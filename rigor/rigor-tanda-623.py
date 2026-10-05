"""Rigor de la tanda 623 — «¿cómo la encuentro?»: cifras por estratos, el
orden que da igual y el partidario que no esconde caminos."""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

CAM = 'js/constructor/caminos.js'
HTML = 'js/constructor/caminos-html.js'

MUTACIONES = [
    (CAM, 'los repartos vuelven a ser al azar', "    if (colocarEnSuEstrato(s, fijar)) return s", "    return s"),
    (CAM, 'los estratos no se reparten (todos al mismo)', "u: (estratos[i] + azar()) / muestras })", "u: 0.5 })"),
    (CAM, 'una que no has visto va siempre al mazo', "  if (k.confirmados[c1] || !Ph) destino", "  if (true) destino"),
    (CAM, 'el partidario vuelve a esconder caminos', " && (!usaPartidario(q) || usaPartidario(c)))", ")"),
    (CAM, 'el orden siempre importa', "    if (n < 2 || n > 3) return null", "    if (n >= 2) return false"),
    (CAM, 'el orden nunca importa', "      if (solo1 - solo2 > Math.max(muestras * 0.01, 2 * Math.sqrt(solo1 + solo2))) return false", "      if (false) return false"),
    (HTML, '«en cualquier orden» no se dice', "c.ordenDaIgual ? 'Lo mejor, en cualquier orden' :", "false ? '' :"),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-623.mjs')
