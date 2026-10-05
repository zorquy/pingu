"""Rigor de la tanda 593 — los efectos de los ataques, también en español.

Lo que se rompe aquí no da error: el ataque se queda «a mano» (o cuenta
cero) y la partida sigue como si nada. Cada mutación rompe el ORIGEN de una
lectura o de una cuenta.
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

ES = 'js/constructor/textos-es.js'
TX = 'js/constructor/textos.js'
PAR = 'js/constructor/partida.js'

MUTACIONES = [
    # El traductor
    (ES, 'el veto de objetos de Budew no se traduce', """  [/^durante el próximo turno de tu rival, este no puede jugar ninguna carta de objeto de su mano$/, () => "during your opponent's next turn, they can't play any item cards from their hand"],\n""", ''),
    (ES, '«si sale cara» no traduce su rama', "    return dentro ? `if ${rama[1] === 'cara' ? 'heads' : 'tails'}, ${dentro}` : null", '    return null'),
    (ES, 'los dueños en español se quedan en español', "  'de eco': \"ethan's\",", "  'de eco': 'de eco',"),
    (ES, '«{G} y Pokémon {R}» como una sola clase', "    .join(' pokémon and ')", "    .join(' and ')"),
    (ES, '«energía especial» no se entiende', "  if (/^energías? especial(?:es)?$/.test(t)) return 'special energy'\n", ''),
    # El lector
    (TX, 'el ataque no pasa por el español', '  const fs = frases(texto).map((f) => alIngles(f) ?? f)', '  const fs = frases(texto)'),
    (TX, 'la habilidad no pasa por el español', '  const fs = frases(clave).map((f) => alInglesHabilidad(f) ?? f)', '  const fs = frases(clave)'),
    (TX, 'el símbolo en HTML no se lee', """    .replace(/<span[^>]*class="energy-symbol (\\w+)"[^>]*>[^<]*<\\/span>/gi, (x, tipo) => (LETRA_DE_TIPO[tipo.toLowerCase()] ? `{${LETRA_DE_TIPO[tipo.toLowerCase()]}}` : x))\n""", ''),
    (TX, 'los dos estados en el orden de la carta', '.filter(Boolean).sort() })],', '.filter(Boolean) })],'),
    (TX, '«no puede usar ataques» como un ataque llamado así', "  [/^during your next turn, this pokémon can't (?:attack|use attacks)$/, () => ({ t: 'noAtacaSiguiente' })],", "  [/^during your next turn, this pokémon can't attack$/, () => ({ t: 'noAtacaSiguiente' })],"),
    # La partida
    (PAR, '«tus Pokémon {G}» se busca como dueño', "  if (tipo) return esDeTipo(c, tipo[1].toUpperCase())\n  if (k === 'basic')", "  if (k === 'basic')"),
    (PAR, '«Energía {R}» se busca por el nombre', "    if (tipo) return this.unidadesDe(slot).some((u) => u.includes(tipo[1].toUpperCase()))\n", ''),
    (PAR, '«Uxie y Azelf» como un solo nombre', "          if (!normalizarNombre(p.nombre).split(/ and | y /).every(enBanca))", "          if (![normalizarNombre(p.nombre)].every(enBanca))"),
    (PAR, 'el bono solo para dueños', "      const vale = r.de.split(/ pokémon and /).some((k) => esDeLaClase(c, k))", "      const vale = r.de.split(/ pokémon and /).some((k) => /'s$/.test(k) && esDeLaClase(c, k))"),
    (PAR, 'el KO se guarda por el nombre', "        op.s.koUltimo = [...(op.s.koUltimo || []), { name: c.name, name_es: c.name_es, types: c.types, stage: c.stage, evolve_from: c.evolve_from, category: c.category }]", "        op.s.koUltimo = [...(op.s.koUltimo || []), claveDeEfecto(c)]"),
    (PAR, 'los premios que QUEDAN en vez de los cogidos', "        case 'porPremios': porCada(Math.max(0, 6 - (p.de === 'propio' ? s.premios.length : r.premios)), p.n); break", "        case 'porPremios': porCada(p.de === 'propio' ? s.premios.length : r.premios, p.n); break"),
    (PAR, 'menos por contadores suma', "        case 'menosPorContadoresPropio': out.danio -= p.n", "        case 'menosPorContadoresPropio': out.danio += p.n"),
    (PAR, 'la herramienta se descarta pero sigue puesta', "          const u = ra.herramienta\n          ra.herramienta = null\n", "          const u = ra.herramienta\n"),
    (PAR, 'el que descarta lo elige quien ataca', "zona: 'mano', partida: op, elige: op, sinCancelar: true })\n          op.descartar(el)", "zona: 'mano', partida: this, elige: this, sinCancelar: true })\n          op.descartar(el)"),
    (PAR, 'el descarte al azar no descarta', "          const u = op.s.mano[Math.floor(this.azar() * op.s.mano.length)]\n          op.descartar([u])\n", "          const u = op.s.mano[Math.floor(this.azar() * op.s.mano.length)]\n"),
    (PAR, 'buscar un partidario ofrece todo el mazo', "filtro: (x) => filtro(x), max: p.n })", "filtro: () => true, max: p.n })"),
    (PAR, 'robar HASTA 6 roba 6', "          this.robarHasta(p.n, { motivo: ataque.name })\n          break", "          this.robar(p.n, { motivo: ataque.name })\n          break"),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-593.mjs')
