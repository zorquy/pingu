"""Rigor de la tanda 913 — las repeticiones con las cartas reconocidas.

Cada mutación rompe el ORIGEN de un arreglo: el lector (los «del», el fondo
de la baraja, los mulligans, los contadores movidos, curar, los estados), la
mesa (Camilla Nocturna, el dueño de los contadores, Ruinas Peligrosas, la
marca de lo que sube por jugador, los estados que se curan y la parálisis
que se pasa), el resolutor (la impresión con ficha, fuera Pocket), lo que se
completa desde otra impresión (la original de un Prize Pack, las modernas,
las fichas y los ataques), la lista en dos idiomas y la foto de Jugar igual
que la de Mi colección."""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

RE = 'js/repeticiones/registro.js'
ES = 'js/repeticiones/estado.js'
LI = 'js/repeticiones/lista.js'
GE = 'js/constructor/gemelas.js'
DA = 'js/constructor/datos.js'
RP = 'js/repeticiones.js'
LA = 'js/constructor/laboratorio.js'

MUTACIONES = [
    (RE, 'el «del» se parte por el último', "  elegirPartes(eventos)\n  return { jugadores, eventos, sinLeer }", "  return { jugadores, eventos, sinLeer }"),
    (RE, '«en la parte inferior» no se entiende', "|en la parte (?:inferior|superior)) de su baraja$`), (m) => ({ tipo: 'alMazo', jugador: m[1], n: num(m[2]) })],", ") de su baraja$`), (m) => ({ tipo: 'alMazo', jugador: m[1], n: num(m[2]) })],"),
    (RE, '«2 mulligans» no casa', "(?:(un|\\\\d+) )?mulligans?`", "(?:un )?mulligan`"),
    (RE, '«Se han curado…» no se entiende', "    [new RegExp(`^Se (?:ha|han) curado (\\\\d+) puntos? de daño al? (.+) de ${P}$`), (m) => ({ tipo: 'curar', jugador: m[3], pokemon: nombreDeCarta(m[2]), danio: +m[1] })],\n", ""),
    (RE, 'el chequeo no se entiende', "    [/^Chequeo Pok[eé]mon$|^Pok[eé]mon Checkup$/i, () => ({ tipo: 'chequeo' })],\n", ""),
    (ES, 'Camilla Nocturna se lleva el de la banca', "const delDescarte = cartas.length === 1 && p.descarte.some((x) => igual(x, cartas[0]))", "const delDescarte = false"),
    (ES, 'el destino de los contadores movidos, el de la frase', "      const duenoA = duenoDeContadores(s, e.jugador, e.dice, e.a)", "      const duenoA = e.dice"),
    (ES, 'el que los pone no es candidato a dueño', "for (const n of [rival, dice, quienPone])", "for (const n of [rival, dice])"),
    (ES, 'Ruinas Peligrosas al que más daño lleva', "      const reciente = e.padre?.tipo === 'activar' && q ? masReciente(q, e.pokemon, golpeados) : null", "      const reciente = null"),
    (ES, 'la marca de lo que sube, una para los dos', "      s.subio = { ...(s.subio || {}), [e.jugador]: sube.id }", "      s.subio = { [e.jugador]: sube.id }"),
    (ES, 'los estados no se ponen', "      if (slot) ponerEstado(slot, e.estado, s.turno)", ""),
    (ES, 'retirarse no cura los estados', "        p.activo = null\n        sinEstados(slot)\n        p.banca.push(slot)", "        p.activo = null\n        p.banca.push(slot)"),
    (ES, 'la parálisis no se pasa', "s.turno >= x.paralizadoEn + 2", "s.turno >= x.paralizadoEn + 99"),
    (ES, 'el envenenado se quita con el confundido', "  slot.estados = [...(GIRAN.includes(estado) ? actuales.filter((x) => !GIRAN.includes(x)) : actuales.filter((x) => x !== estado)), estado]", "  slot.estados = [estado]"),
    (LI, 'la lista casa solo por el nombre del registro', "    for (const n of [plano(nombre), ...nombresDe(cartaDe(nombre))]) if (porNombre.get(n)?.length) return porNombre.get(n)", "    for (const n of [plano(nombre)]) if (porNombre.get(n)?.length) return porNombre.get(n)"),
    (LI, 'dos nombres de la misma carta no suman', "    const ya = es.length ? usadas.get(es[0]) || 0 : 0", "    const ya = 0"),
    (GE, 'sin la original de un Prize Pack', "  const original = origen ? otras.find((g) => numeroPlano(g.local_id) === origen.numero && Number(totalDeSet(g.set_id)) === origen.total) : null", "  const original = null"),
    (GE, 'sin el grupo de las modernas', "  const grupo = [otras, otras.filter((g) => g.regulation_mark)].find(psUnanimes) || null", "  const grupo = [otras].find(psUnanimes) || null"),
    (GE, 'los ataques sin exigir los mismos PS', "    else if (!SOLO_LA_MISMA.has(k) && k !== 'hp') valor = unanime(otras, k)", "    else valor = unanime(otras, k)"),
    (DA, 'la impresión sin ficha gana por marca', "      if (fa !== fb) return fb - fa\n", ""),
    (DA, 'las de Pocket cuentan', "    const pool = delTcg.length ? delTcg : todas", "    const pool = todas"),
    (DA, 'cartasPorIds no completa', "  if (completar) for (const c of await completarConOtras([...fuera.values()])) fuera.set(c.id, c)", ""),
    (DA, 'el laboratorio no recibe los ataques', "  for (const c of await completarConOtras(sinJugar, { campos: CAMPOS_DE_JUEGO, canonizarGemelas: false })) fuera.set(c.id, c)\n", ""),
    (DA, 'las filas de Jugar sin el set embebido', ",types,tcg_sets(serie_id,tcg_online_code)'", ",types'"),
    (RP, 'la foto de la repetición con la dirección de TCGdex a pelo', "    cadena = cadenaDeEscaneo(c, R.codigoDeSet(c.set_id), calidad)\n", "    cadena = cadenaDeEscaneo(c, R.codigoDeSet(c.set_id), calidad, (r, q) => `https://assets.tcgdex.net/en/${r}/${q}.webp`)\n"),
    (RP, 'los estados no se pintan', "${herramienta || evo || estados ? `<div class=\"lab-chapas\">${estados}${herramienta}${evo}</div>` : ''}", "${herramienta || evo ? `<div class=\"lab-chapas\">${herramienta}${evo}</div>` : ''}"),
    (LA, 'abrir el laboratorio espera al premio obligatorio', "j.s.banca.length)) hacer(async () => {})\n  return resumen", "j.s.banca.length)) await hacer(async () => {})\n  return resumen"),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-913.mjs')
