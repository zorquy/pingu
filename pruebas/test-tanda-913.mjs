// Tanda 913 — las repeticiones con las cartas reconocidas y la mesa en regla.
//
// PINGU: «en el apartado de jugar muchas cartas no se reconocen en
// repeticiones, movimientos, energías unidas que salen mal… y a veces da
// error alguna carta al añadir una lista a una repetición». Pasadas sus 13
// repeticiones guardadas por el lector contra producción, salió:
//
//   · 18 de 125 cartas resueltas eran impresiones de TCGGO sin ficha (Prize
//     Pack, 30 aniversario): sin categoría, sin PS, sin ataques, sin español.
//   · Camilla Nocturna se llevaba de la mesa al Pokémon de la banca que se
//     llamaba como el recuperado del descarte.
//   · «Se ha descartado Energía del Team Rocket del Murkrow del Team Rocket
//     de J» se partía por el «del» equivocado: la energía se quedaba puesta.
//   · 62 líneas sin entender (contadores movidos, veneno, curar, la mano al
//     fondo, «2 mulligans», estados…) y 3 partidas descuadradas.
//
// Los dos registros son DE VERDAD (los de PINGU con los nombres cambiados por
// Rojo y Azul, comprobados byte a byte contra producción); el tercero, corto,
// está armado con líneas de verdad de otras partidas.
import { readFileSync } from 'node:fs'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const RAIZ = '/home/user/pingu'
const BASE = process.env.PD_BASE || process.env.BASE || 'http://localhost:8892'
const { leerRegistro, partesPorDel } = await import(`${RAIZ}/js/repeticiones/registro.js`)
const { fotos, arriba } = await import(`${RAIZ}/js/repeticiones/estado.js`)
const { mazoConLista, sinVerEnLaFoto } = await import(`${RAIZ}/js/repeticiones/lista.js`)
const { completarConGemelas, faltanDatos, CAMPOS_DE_JUEGO } = await import(`${RAIZ}/js/constructor/gemelas.js`)
const CAMILLA = readFileSync(new URL('./registro-913-camilla.txt', import.meta.url), 'utf8')
const ROCKET = readFileSync(new URL('./registro-913-rocket.txt', import.meta.url), 'utf8')

const plano = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const enJuego = (p) => [p.activo, ...p.banca].filter(Boolean)
const total = (s, n) => {
  const p = s.jugadores[n]
  return p.mano + p.mazo + p.descarte.length + p.premios + enJuego(p).reduce((a, x) => a + x.cartas.length + x.energias.length + (x.herramienta ? 1 : 0), 0) + (s.estadio?.dueno === n ? 1 : 0)
}
const cuadra = (fs) => {
  const malas = []
  fs.forEach((s, i) => {
    if (!s.turno) return
    for (const n of s.orden) if (total(s, n) !== 60 || s.jugadores[n].mano < 0 || s.jugadores[n].mazo < 0) malas.push(`${i}:${n}=${total(s, n)}`)
  })
  return malas
}
const fotoTras = (ev, pred, desde = 0) => ev.findIndex((e, i) => i >= desde && pred(e)) + 1
const llamados = (p, nombre) => enJuego(p).filter((x) => plano(arriba(x)) === plano(nombre))

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. La partida de Camilla Nocturna (registro de verdad) ──')
{
  const l = leerRegistro(CAMILLA)
  const fs = fotos(l)
  const ev = l.eventos
  check('se entiende entera («ha barajado sus cartas» era una línea sin leer)', l.sinLeer.length === 0, l.sinLeer.join(' | '))
  check('las 60 cartas de cada uno cuadran en todas las fotos', cuadra(fs).length === 0, cuadra(fs).slice(0, 4).join(', '))
  const i = fotoTras(ev, (e) => e.tipo === 'aMano' && e.cartas?.[0] === 'Dunsparce')
  const antes = fs[i - 1].jugadores.Rojo
  const despues = fs[i].jugadores.Rojo
  check('Camilla Nocturna: el Dunsparce sale del DESCARTE…', antes.descarte.filter((c) => c === 'Dunsparce').length - despues.descarte.filter((c) => c === 'Dunsparce').length === 1, `${antes.descarte.join(',')} → ${despues.descarte.join(',')}`)
  check('  …y el Dunsparce de la banca se queda en la mesa (antes se lo llevaba)', llamados(antes, 'Dunsparce').length === 1 && llamados(despues, 'Dunsparce').length === 1, `${llamados(antes, 'Dunsparce').length} → ${llamados(despues, 'Dunsparce').length}`)
  // Y por eso, al final, cada evolución de un Dunsparce encuentra a quién.
  const evos = ev.map((e, k) => [e, k]).filter(([e]) => e.tipo === 'evolucionar' && e.de === 'Dunsparce')
  const sinSitio = evos.filter(([, k]) => fs[k + 1].foco?.tipo !== 'evoluciona')
  check('todas las evoluciones de un Dunsparce encuentran su Dunsparce', evos.length >= 3 && sinSitio.length === 0, sinSitio.map(([e]) => e.fila).join(','))
  const unir = fotoTras(ev, (e) => e.tipo === 'unir' && e.a === 'Dudunsparce')
  check('  …y la Energía Enriquecedora se une al Dudunsparce de la banca', fs[unir].foco?.tipo === 'unir' && fs[unir].foco?.slot, JSON.stringify(fs[unir].foco))
  // El Ventilador de Mano mueve la energía del que ATACA (el activo).
  const fan = fotoTras(ev, (e) => e.tipo === 'unir' && e.sub && e.a === 'Beldum' && e.padre?.tipo === 'activar')
  const az = fs[fan].jugadores.Azul
  check('Ventilador de Mano: la energía sale del activo de Azul y va al Beldum', fan > 0 && az.banca.some((x) => arriba(x) === 'Beldum' && x.energias.length === 1), JSON.stringify(enJuego(az).map((x) => [arriba(x), x.energias.length])))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. La partida del Team Rocket (registro de verdad) ──')
{
  const l = leerRegistro(ROCKET)
  const fs = fotos(l)
  const ev = l.eventos
  check('se entiende entera («3 mulligans», la mano al fondo, una carta con nombre a la baraja)', l.sinLeer.length === 0, l.sinLeer.join(' | '))
  check('las 60 cartas de cada uno cuadran en todas las fotos (antes: 150 fotos mal)', cuadra(fs).length === 0, cuadra(fs).slice(0, 4).join(', '))
  const d = ev.find((e) => e.tipo === 'descartarDe' && /Murkrow/.test(e.linea))
  check('«Energía del Team Rocket del Murkrow del Team Rocket» se parte por el «del» bueno', d?.carta === 'Energía del Team Rocket' && d?.pokemon === 'Murkrow del Team Rocket', JSON.stringify([d?.carta, d?.pokemon]))
  const k = fotoTras(ev, (e) => e === d)
  check('  …y la energía se va del Murkrow (antes se quedaba puesta)', fs[k - 1].jugadores.Azul.banca.some((x) => x.energias.length === 1) && enJuego(fs[k].jugadores.Azul).every((x) => !x.energias.length), JSON.stringify(enJuego(fs[k].jugadores.Azul).map((x) => x.energias.length)))
  const ign = ev.filter((e) => e.tipo === 'descartarDe' && /Ignición/.test(e.linea))
  check('«Energía Ignición del Honchkrow del Team Rocket»: las tres, bien partidas', ign.length === 3 && ign.every((e) => e.carta === 'Energía Ignición' && e.pokemon === 'Honchkrow del Team Rocket'), JSON.stringify(ign.map((e) => [e.carta, e.pokemon])))
  check('ningún nombre de carta sale «Team Rocket» a secas', !ev.some((e) => [e.carta, e.pokemon, e.a].includes('Team Rocket')))
  // Giovanni cambia los DOS activos; las dos líneas de «pasa a estar» son la
  // misma jugada contada otra vez.
  const g = fotoTras(ev, (e) => e.tipo === 'jugar' && e.carta === 'Giovanni del Team Rocket')
  const pasa = ev.map((e, n) => [e, n]).filter(([e, n]) => n >= g && n < g + 6 && e.tipo === 'pasaActivo')
  check('Giovanni: las dos «pasa a estar en el Puesto Activo» señalan al que subió', pasa.length === 2 && pasa.every(([, n]) => fs[n + 1].foco?.tipo === 'sube' && fs[n + 1].foco?.slot), JSON.stringify(pasa.map(([, n]) => fs[n + 1].foco)))
  const tras = fs[pasa.at(-1)[1] + 1]
  check('  …y arriba quedan el Murkrow de Azul y el Kadabra de Rojo', arriba(tras.jugadores.Azul.activo) === 'Murkrow del Team Rocket' && arriba(tras.jugadores.Rojo.activo) === 'Kadabra')
  // Y el MISMO Murkrow que subió con el intercambio: Azul tiene otros tres
  // en la banca, y con la marca de lo que sube pisada por el cambio de Rojo,
  // la segunda línea los volvía a cambiar por otro gemelo.
  const inter = ev.findIndex((e, n) => n >= g && e.tipo === 'intercambio' && e.jugador === 'Azul') + 1
  check('  …y es el MISMO Murkrow que subió con el intercambio (no un gemelo de la banca)', fs[inter].jugadores.Azul.activo.id === tras.jugadores.Azul.activo.id, `${fs[inter].jugadores.Azul.activo.id} → ${tras.jugadores.Azul.activo.id}`)
  check('«Rojo ha declarado 3 mulligans» es un mulligan', ev.some((e) => e.tipo === 'mulligan' && e.n === 3))
  // Tarjeta Roja Especial: la mano al fondo y robar 3.
  const t = fotoTras(ev, (e) => e.tipo === 'alMazo' && /parte inferior/.test(e.linea))
  const a0 = fs[t - 1].jugadores.Azul
  const a1 = fs[t].jugadores.Azul
  check('Tarjeta Roja: las 6 cartas de la mano van al fondo de la baraja', a0.mano === 6 && a1.mano === 0 && a1.mazo === a0.mazo + 6, `${a0.mano}/${a0.mazo} → ${a1.mano}/${a1.mazo}`)
  check('  …y «ha barajado las cartas de su mano» se entiende (barajar)', ev[t - 2]?.tipo === 'barajar', ev[t - 2]?.tipo)
  const ceniza = ev.find((e) => e.tipo === 'alMazo' && e.cartas?.[0] === 'Dedenne')
  check('«ha puesto Dedenne en su baraja y ha barajado todas las cartas»: esa carta, del descarte o de la mano', Boolean(ceniza))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. Contadores, venenos y estados (líneas de verdad) ──')
const CORTA = `Preparación
Rojo ha elegido cruz para el lanzamiento de moneda inicial.
Azul ha ganado el lanzamiento de moneda.
Azul ha decidido empezar en segundo lugar.
Rojo ha robado 7 cartas de la mano inicial.
- 7 cartas robadas.
   • Dedenne, Abra, Abra, Abra, Pokochos Gemelos, Maya, Liza
Azul ha robado 7 cartas de la mano inicial.
- 7 cartas robadas.
Azul ha declarado 2 mulligans.
- Cartas mostradas por el mulligan número 1
   • Maya, Maya, Maya, Maya, Maya, Maya, Maya
- Cartas mostradas por el mulligan número 2
   • Maya, Maya, Maya, Maya, Maya, Maya, Maya
Azul ha robado 7 cartas de la mano inicial.
- 7 cartas robadas.
Rojo ha puesto en juego a Dedenne en el Puesto Activo.
Rojo ha puesto en juego a Abra en la Banca.
Azul ha puesto en juego a Munkidori en el Puesto Activo.

Turno de Rojo
Rojo ha robado una carta.
El Dedenne de Rojo ha infligido 30 puntos de daño usando Chispazo contra el Munkidori de Azul.
Rojo ha terminado su turno.

Turno de Azul
Azul ha robado una carta.
El Munkidori de Azul ha usado Adrenalina Mental.
- Azul ha movido un contador de daño del Munkidori de Azul al Abra de Azul.
Azul ha puesto en juego la carta de Estadio Ruinas Peligrosas.
El Munkidori de Azul ha infligido 10 puntos de daño usando Golpe Tóxico contra el Dedenne de Rojo.
- El Dedenne de Rojo pasa a estar Envenenado.
- El Dedenne de Rojo pasa a estar Confundido.
Azul ha terminado su turno.

Chequeo Pokémon
Se ha colocado un contador de daño en el Dedenne de Rojo por estar afectado por la Condición Especial Envenenado.

Turno de Rojo
Rojo ha robado una carta.
Rojo ha jugado Pokochos Gemelos.
- Rojo ha robado 2 cartas y las ha puesto en juego en la Banca.
   • Abra, Abra
- Rojo ha barajado su baraja.
Se ha activado Ruinas Peligrosas.
- El Abra de Azul ha recibido 2 contadores de daño de Rojo.
- El Abra de Azul ha recibido 2 contadores de daño de Rojo.
Se ha activado Jaula de Combate.
- Se ha evitado el daño infligido a Abra.
Rojo ha jugado Liza.
- Se han curado 10 puntos de daño al Dedenne de Rojo.
Rojo ha retirado a Dedenne a la Banca.
El Abra de Rojo pasa a estar en el Puesto Activo.
Rojo ha terminado su turno.

Turno de Azul
Azul ha robado una carta.
El Munkidori de Azul ha infligido 10 puntos de daño usando Golpe Tóxico contra el Abra de Rojo.
- El Abra de Rojo pasa a estar Paralizado.
Azul ha terminado su turno.

Turno de Rojo
Rojo ha robado una carta.
Rojo ha terminado su turno.

Turno de Azul
Azul ha robado una carta.
Azul ha terminado su turno.`
{
  const l = leerRegistro(CORTA)
  const fs = fotos(l)
  const ev = l.eventos
  check('todas las líneas se entienden', l.sinLeer.length === 0, l.sinLeer.join(' | '))
  check('«Azul ha declarado 2 mulligans» es un mulligan con su número', ev.some((e) => e.tipo === 'mulligan' && e.jugador === 'Azul' && e.n === 2))
  check('«Chequeo Pokémon» y «Se ha evitado el daño…» se entienden sin mover nada', ev.some((e) => e.tipo === 'chequeo') && ev.some((e) => e.tipo === 'evitado' && e.pokemon === 'Abra'))
  const m = fotoTras(ev, (e) => e.tipo === 'moverContadores')
  const mun = fs[m].jugadores.Azul.activo
  const abraRojo = fs[m].jugadores.Rojo.banca.find((x) => arriba(x) === 'Abra')
  check('Adrenalina Mental: el Munkidori pasa de 30 a 20…', fs[m - 1].jugadores.Azul.activo.danio === 30 && mun.danio === 20, `${fs[m - 1].jugadores.Azul.activo.danio} → ${mun.danio}`)
  check('  …y el contador cae en el Abra de ROJO, aunque la línea diga «de Azul»', abraRojo?.danio === 10, JSON.stringify(enJuego(fs[m].jugadores.Rojo).map((x) => [arriba(x), x.danio])))
  const e1 = fotoTras(ev, (e) => e.tipo === 'estado' && e.estado === 'envenenado')
  const e2 = fotoTras(ev, (e) => e.tipo === 'estado' && e.estado === 'confundido')
  check('el Dedenne queda Envenenado y Confundido (los dos)', JSON.stringify(fs[e2].jugadores.Rojo.activo.estados.slice().sort()) === '["confundido","envenenado"]', JSON.stringify(fs[e2].jugadores.Rojo.activo.estados))
  check('  …el veneno no se quita con el otro estado', fs[e1].jugadores.Rojo.activo.estados.includes('envenenado'))
  const v = fotoTras(ev, (e) => e.tipo === 'contadores' && /Envenenado/.test(e.linea))
  check('el veneno del chequeo pone su contador en el Dedenne de Rojo', fs[v].jugadores.Rojo.activo.danio - fs[v - 1].jugadores.Rojo.activo.danio === 10, `${fs[v - 1].jugadores.Rojo.activo.danio} → ${fs[v].jugadores.Rojo.activo.danio}`)
  const r1 = fotoTras(ev, (e) => e.tipo === 'contadores' && /Abra de Azul/.test(e.linea))
  const r2 = r1 + 1
  const abras = (s) => enJuego(s.jugadores.Rojo).filter((x) => arriba(x) === 'Abra').map((x) => x.danio)
  check('Ruinas Peligrosas: 20 a cada uno de los dos Abra de Rojo que ACABAN de llegar (el de 10 se queda igual)', JSON.stringify(abras(fs[r2]).sort((a, b) => a - b)) === '[10,20,20]', JSON.stringify(abras(fs[r2])))
  const c = fotoTras(ev, (e) => e.tipo === 'curar')
  check('«Se han curado 10 puntos de daño al Dedenne» le quita 10', fs[c - 1].jugadores.Rojo.activo.danio - fs[c].jugadores.Rojo.activo.danio === 10, `${fs[c - 1].jugadores.Rojo.activo.danio} → ${fs[c].jugadores.Rojo.activo.danio}`)
  const ret = fotoTras(ev, (e) => e.tipo === 'retirar')
  const ded = fs[ret].jugadores.Rojo.banca.find((x) => arriba(x) === 'Dedenne')
  check('al retirarse a la banca, el Dedenne se cura de sus estados', ded && ded.estados.length === 0, JSON.stringify(ded?.estados))
  const p = fotoTras(ev, (e) => e.tipo === 'estado' && e.estado === 'paralizado')
  check('el Abra queda Paralizado…', fs[p].jugadores.Rojo.activo.estados.includes('paralizado'))
  const turnoRojo = fotoTras(ev, (e) => e.tipo === 'turno' && e.jugador === 'Rojo', p)
  const turnoAzul = fotoTras(ev, (e) => e.tipo === 'turno' && e.jugador === 'Azul', turnoRojo)
  check('  …lo sigue en su turno siguiente…', fs[turnoRojo].jugadores.Rojo.activo.estados.includes('paralizado'))
  check('  …y se le pasa en el chequeo de después (al empezar el turno del otro)', !fs[turnoAzul].jugadores.Rojo.activo.estados.includes('paralizado'), JSON.stringify(fs[turnoAzul].jugadores.Rojo.activo.estados))
  check('partesPorDel da las tres maneras de partir', partesPorDel('Energía del Team Rocket del Murkrow del Team Rocket').length === 3)
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. Lo que le falta a una impresión, de otra (gemelas.js) ──')
{
  const total = (id) => ({ sv05: 162, sv08: 191 })[id] ?? null
  const premio = { id: 'tcggo-76046', set_id: 'tg-741', local_id: '129/162', name: 'Dudunsparce', name_key: 'dudunsparce', category: null, hp: null }
  const gem = [
    { id: 'sv05-129', set_id: 'sv05', local_id: '129', name_key: 'dudunsparce', category: 'Pokemon', hp: 140, stage: 'Stage1', name_es: 'Dudunsparce', types: ['Colorless'], attacks: [{ name: 'Aterrizaje', cost: ['C', 'C', 'C'], damage: '90' }], abilities: [{ name: 'Robo a la Fuga', type: 'Ability' }] },
    { id: 'sv08-150', set_id: 'sv08', local_id: '150', name_key: 'dudunsparce', category: 'Pokemon', hp: 130, stage: 'Stage1', name_es: 'Dudunsparce', types: ['Colorless'], attacks: [{ name: 'Otro', cost: ['C'], damage: '30' }] },
  ]
  const a = completarConGemelas(premio, gem, { campos: ['category', 'hp', 'stage', 'name_es', 'attacks', 'abilities'], totalDeSet: total })
  check('un Prize Pack «129/162» toma la ficha de la original (la 129 del set de 162)', a.category === 'Pokemon' && a.hp === 140 && a.attacks?.[0]?.name === 'Aterrizaje' && a.abilities?.[0]?.name === 'Robo a la Fuga', JSON.stringify(a))
  const sinOrigen = { ...premio, local_id: '066' }
  const b = completarConGemelas(sinOrigen, gem, { campos: ['category', 'hp', 'attacks', 'name_es'], totalDeSet: total })
  check('sin saber cuál es, con dos que se llaman igual y tienen PS distintos: ni PS ni ataques…', b.hp == null && b.attacks == null, JSON.stringify(b))
  check('  …pero sí lo que todas dicen igual (categoría, nombre en español)', b.category === 'Pokemon' && b.name_es === 'Dudunsparce', JSON.stringify(b))
  const mew = { id: 'tcggo-65689', set_id: '30th', local_id: '066', name_key: 'mew ex', category: null, hp: null }
  const mews = [
    { id: 'ex-mew', set_id: 'ex13', local_id: '1', name_key: 'mew ex', category: 'Pokemon', hp: 90, regulation_mark: null },
    { id: 'sv03.5-151', set_id: 'sv03.5', local_id: '151', name_key: 'mew ex', category: 'Pokemon', hp: 180, regulation_mark: 'G' },
    { id: 'svp-053', set_id: 'svp', local_id: '053', name_key: 'mew ex', category: 'Pokemon', hp: 180, regulation_mark: 'G' },
  ]
  check('entre todas no coinciden los PS; entre las modernas (con letra), sí: 180', completarConGemelas(mew, mews, { campos: ['category', 'hp'] }).hp === 180)
  const ball = { id: 'tcggo-65651', set_id: '30th', local_id: '128', name_key: 'ultra ball', category: null, trainer_type: null }
  const c = completarConGemelas(ball, [{ id: 'me01-131', name_key: 'ultra ball', category: 'Trainer', trainer_type: 'Item', name_es: 'Ultra Ball' }], { campos: ['category', 'trainer_type', 'name_es'] })
  check('una Ultra Ball del 30 aniversario sabe que es un Objeto', c.category === 'Trainer' && c.trainer_type === 'Item', JSON.stringify(c))
  check('una carta con todo no se toca (la misma fila)', completarConGemelas(gem[0], gem, { campos: ['category', 'hp'] }) === gem[0])
  // Dos Pikachu distintos: PS distintos, y solo uno trae sus ataques. Copiar
  // «lo que todas las que lo tienen dicen igual» daría los de ese.
  const pika = { id: 'tcggo-9', set_id: 'tg-1', local_id: '025', name_key: 'pikachu', category: null, hp: null, attacks: null }
  const pikas = [
    { id: 'a-25', set_id: 'a', local_id: '25', name_key: 'pikachu', category: 'Pokemon', hp: 60, attacks: [{ name: 'Impactrueno', cost: ['L'], damage: '20' }] },
    { id: 'b-25', set_id: 'b', local_id: '25', name_key: 'pikachu', category: 'Pokemon', hp: 70, attacks: null },
  ]
  const d = completarConGemelas(pika, pikas, { campos: ['category', 'hp', 'attacks'] })
  check('con PS que no coinciden no se copian ataques de la única que los trae', d.category === 'Pokemon' && d.hp == null && d.attacks == null, JSON.stringify(d))
  check('faltanDatos ve lo que falta para jugar', faltanDatos({ name_key: 'x', hp: 10 }, CAMPOS_DE_JUEGO) && !faltanDatos({ name_key: 'x', attacks: [1], abilities: [1], retreat: 1, weaknesses: [1], resistances: [1], hp: 1, types: [1], stage: 'b', evolve_from: 'y' }, CAMPOS_DE_JUEGO))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 5. La lista y el registro en dos idiomas (lista.js) ──')
{
  // La fila de la lista solo tiene el inglés (una impresión de TCGGO), el
  // registro dice el español, y la repetición le ha encontrado al nombre del
  // registro OTRA impresión de la misma carta.
  const poffinLista = { id: 'tcggo-1', name: 'Buddy-Buddy Poffin', name_es: null, category: 'Trainer' }
  const poffinRegistro = { id: 'me02.5-184', name: 'Pokochos Gemelos', name_es: 'Pokochos Gemelos', category: 'Trainer' }
  const abra = { id: 'me01-054', name: 'Abra', name_es: 'Abra', category: 'Pokemon' }
  const lista = [{ carta: poffinLista, n: 4 }, { carta: abra, n: 4 }]
  const cartaDe = (n) => ({ 'pokochos gemelos': { ...poffinRegistro, name: 'Buddy-Buddy Poffin' }, abra })[plano(n)] || null
  const vistas = [{ nombre: 'Pokochos Gemelos', copias: 3, tipo: 'entrenador' }, { nombre: 'Abra', copias: 2, tipo: 'pokemon' }]
  const r = mazoConLista(lista, vistas, cartaDe)
  check('«Pokochos Gemelos» del registro es la «Buddy-Buddy Poffin» de la lista: nada «fuera»', r.fuera.length === 0, JSON.stringify(r.fuera))
  check('  …y el registro sabe de qué entrada es (para «Jugar desde aquí»)', r.idDe('Pokochos Gemelos') === 'tcggo-1' && r.idDe('Abra') === 'me01-054', `${r.idDe('Pokochos Gemelos')} ${r.idDe('Abra')}`)
  const sinCarta = mazoConLista(lista, vistas, () => null)
  check('sin la carta del registro, por el nombre a secas no casa (el caso de antes)', sinCarta.fuera.some((f) => f.nombre === 'Pokochos Gemelos'), JSON.stringify(sinCarta.fuera))
  const foto = { jugadores: { Rojo: { activo: null, banca: [], descarte: ['Pokochos Gemelos', 'Pokochos Gemelos'], manoConocida: [], mano: 0 } } }
  const sv = sinVerEnLaFoto(lista, foto, 'Rojo', cartaDe)
  check('lo que queda sin ver resta las Pokochos vistas de la Buddy-Buddy Poffin', sv.cartas.find((c) => c.carta.id === 'tcggo-1')?.n === 2, JSON.stringify(sv.cartas.map((c) => [c.carta.id, c.n])))
  const doble = mazoConLista([{ carta: abra, n: 2 }], [{ nombre: 'Abra', copias: 2 }, { nombre: 'abra', copias: 1 }], (n) => (plano(n) === 'abra' ? abra : null))
  check('dos nombres del registro que son la misma carta suman contra sus copias', doble.fuera.reduce((k, f) => k + f.copias, 0) === 1, JSON.stringify(doble.fuera))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 6. El resolutor y la foto, contra el catálogo (navegador) ──')
const browser = await chromium.launch()
{
  const SETS = [
    { id: 'sv05', name: 'Temporal Forces', market: 'WEST', serie_id: 'sv', tcg_online_code: 'TEF', release_date: '2024-03-22', card_count_official: 162 },
    { id: 'tg-741', name: 'Play! Pokémon Prize Pack Series Seven', market: 'WEST', serie_id: 'prize-pack', tcg_online_code: null, release_date: '2025-08-14', card_count_official: 0 },
    { id: 'P-A', name: 'Promos-A', market: 'WEST', serie_id: 'tcgp', tcg_online_code: null, release_date: '2024-10-30', card_count_official: 0 },
    { id: 'sv01', name: 'Scarlet & Violet', market: 'WEST', serie_id: 'sv', tcg_online_code: 'SVI', release_date: '2023-03-31', card_count_official: 198 },
    { id: 'me01', name: 'Mega Evolution', market: 'WEST', serie_id: 'me', tcg_online_code: 'MEG', release_date: '2025-09-26', card_count_official: 132 },
  ]
  const CARTAS = [
    { id: 'sv05-129', set_id: 'sv05', market: 'WEST', local_id: '129', name: 'Dudunsparce', name_es: 'Dudunsparce', category: 'Pokemon', stage: 'Stage1', hp: 140, types: ['Colorless'], regulation_mark: 'H', rarity: 'Rare', image_path: null, attacks: [{ name: 'Aterrizaje', cost: ['C', 'C', 'C'], damage: '90' }], abilities: [{ name: 'Robo a la Fuga', type: 'Ability' }] },
    // El del Prize Pack: marca I (más nueva), sin ficha.
    { id: 'tcggo-76046', set_id: 'tg-741', market: 'WEST', local_id: '129/162', name: 'Dudunsparce', category: null, hp: null, regulation_mark: 'I', rarity: null, image_tcggo: 'https://images.tcggo.com/x.png', origen: 'tcggo' },
    // La de Pocket se llama EXACTAMENTE igual (así la lista TCGdex) y, sin
    // letra y de una colección reciente, cuenta como legal: sin el filtro,
    // ganaba a la de Escarlata y Púrpura (G, ya rotada).
    { id: 'P-A-007', set_id: 'P-A', market: 'WEST', local_id: '007', name: "Professor's Research", name_es: 'Investigación de Profesores', category: 'Trainer', trainer_type: 'Supporter', regulation_mark: null },
    { id: 'sv01-189', set_id: 'sv01', market: 'WEST', local_id: '189', name: "Professor's Research", name_es: 'Investigación de Profesores', category: 'Trainer', trainer_type: 'Supporter', regulation_mark: 'G', image_path: 'sv/sv01/189' },
    // Una foto puesta a mano desde /admin (885): dirección entera.
    { id: 'me01-125', set_id: 'me01', market: 'WEST', local_id: '125', name: 'Caramelo Raro', name_es: 'Caramelo Raro', category: 'Trainer', trainer_type: 'Item', regulation_mark: 'I', image_path: 'https://zqamujmfavwrsqlgbead.supabase.co/storage/v1/object/public/catalogo/caramelo.webp' },
  ]
  const page = await browser.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.route(/\.(png|webp|jpg)(\?|$)/, (r) => r.abort())
  await page.route(/api\.tcgdex\.net/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await page.addInitScript(({ s, c }) => {
    window.__FAKE_SESSION__ = 'none'
    window.__FAKE_SETS__ = s
    window.__FAKE_CARTAS__ = c
  }, { s: SETS, c: CARTAS })
  await page.goto(`${BASE}/constructor`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1000)
  const r = await page.evaluate(async () => {
    const D = await import('/js/constructor/datos.js')
    const { cadenaDeEscaneo } = await import('/js/escaneo-carta.js')
    const dud = (await D.resolverLineas([{ n: 1, nombre: 'Dudunsparce' }])).resueltas.map((x) => x.carta.id)
    const prof = (await D.resolverLineas([{ n: 1, nombre: "Professor's Research" }])).resueltas.map((x) => x.carta.id)
    const premio = (await D.cartasPorIds(['tcggo-76046'])).get('tcggo-76046')
    const juego = (await D.detallesDeJuego(['tcggo-76046'])).get('tcggo-76046')
    const fila = (await D.cartasPorIds(['sv05-129'])).get('sv05-129')
    const caramelo = (await D.cartasPorIds(['me01-125'])).get('me01-125')
    return {
      dud, prof,
      premio: { category: premio?.category, hp: premio?.hp, name_es: premio?.name_es, stage: premio?.stage },
      juego: { ataques: (juego?.attacks || []).map((a) => a.name), hab: (juego?.abilities || []).map((a) => a.name), hp: juego?.hp },
      fila: { market: fila?.market, serie: fila?.tcg_sets?.serie_id, codigo: fila?.tcg_sets?.tcg_online_code },
      cadena: cadenaDeEscaneo(fila),
      cadenaCaramelo: cadenaDeEscaneo(caramelo),
    }
  })
  check('«Dudunsparce» se resuelve a la impresión CON ficha (TEF), no a la del Prize Pack', JSON.stringify(r.dud) === '["sv05-129"]', JSON.stringify(r.dud))
  check('«Professor\'s Research» no se resuelve a la de TCG Pocket', JSON.stringify(r.prof) === '["sv01-189"]', JSON.stringify(r.prof))
  check('la del Prize Pack, pedida por su id, llega con la ficha de la original (categoría, PS, español)', r.premio.category === 'Pokemon' && r.premio.hp === 140 && r.premio.name_es === 'Dudunsparce', JSON.stringify(r.premio))
  check('  …y el laboratorio recibe sus ataques y su habilidad', r.juego.ataques[0] === 'Aterrizaje' && r.juego.hab[0] === 'Robo a la Fuga' && r.juego.hp === 140, JSON.stringify(r.juego))
  check('las filas de Jugar traen el mercado y el set embebido, como en Mi colección', r.fila.market === 'WEST' && r.fila.serie === 'sv' && r.fila.codigo === 'TEF', JSON.stringify(r.fila))
  check('  …así que sin `image_path` la cadena monta la ruta de TCGdex a mano (la de Mi colección)', r.cadena[0] === 'https://assets.tcgdex.net/en/sv/sv05/129/low.webp', JSON.stringify(r.cadena))
  check('  …y una foto puesta a mano desde /admin va la primera, entera', r.cadenaCaramelo[0] === 'https://zqamujmfavwrsqlgbead.supabase.co/storage/v1/object/public/catalogo/caramelo.webp', JSON.stringify(r.cadenaCaramelo))
  check('sin errores en la página', errores.length === 0, errores.join(' | '))
  await page.close()
}

// La página de las repeticiones: la imagen sale por la misma cadena, los
// estados se ven y nada sale «sin entender».
{
  const SETS = [{ id: 'sv05', name: 'Temporal Forces', market: 'WEST', serie_id: 'sv', tcg_online_code: 'TEF', release_date: '2024-03-22', card_count_official: 162 }]
  const CARTAS = [
    { id: 'sv05-087', set_id: 'sv05', market: 'WEST', local_id: '087', name: 'Dedenne', name_es: 'Dedenne', category: 'Pokemon', hp: 70, regulation_mark: 'H', image_path: null },
    { id: 'sv05-054', set_id: 'sv05', market: 'WEST', local_id: '054', name: 'Abra', name_es: 'Abra', category: 'Pokemon', hp: 50, regulation_mark: 'H', image_path: 'sv/sv05/054' },
    // Con la foto puesta a mano desde /admin (885): una dirección entera.
    { id: 'sv05-095', set_id: 'sv05', market: 'WEST', local_id: '095', name: 'Munkidori', name_es: 'Munkidori', category: 'Pokemon', hp: 110, regulation_mark: 'H', image_path: 'https://zqamujmfavwrsqlgbead.supabase.co/storage/v1/object/public/catalogo/munkidori.webp' },
  ]
  const page = await browser.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.route(/\.(png|webp|jpg)(\?|$)/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"/>' }))
  await page.route(/api\.tcgdex\.net/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await page.addInitScript(({ s, c }) => {
    window.__FAKE_SESSION__ = 'none'
    window.__FAKE_SETS__ = s
    window.__FAKE_CARTAS__ = c
  }, { s: SETS, c: CARTAS })
  await page.goto(`${BASE}/repeticiones.html`, { waitUntil: 'domcontentloaded' })
  await page.fill('#repTexto', CORTA)
  await page.click('#repFormulario button[type=submit]')
  await page.waitForSelector('#repSala:not(.hidden)')
  await page.evaluate(() => {
    const b = document.querySelector('[data-accion="reproducir"]')
    if (b.getAttribute('aria-label') === 'Pausa') b.click()
  })
  check('ninguna línea sale como «no entendida»', (await page.locator('.rep-paso-sin-leer').count()) === 0 && (await page.locator('#repSinLeer.hidden').count()) === 1)
  const l = leerRegistro(CORTA)
  const e2 = l.eventos.findIndex((e) => e.tipo === 'estado' && e.estado === 'confundido') + 1
  await page.evaluate((n) => {
    const r = document.getElementById('repProgreso')
    r.value = String(n)
    r.dispatchEvent(new Event('input', { bubbles: true }))
  }, e2)
  await page.waitForFunction(() => document.querySelectorAll('.lab-slot-activo .lab-chapa-estado').length >= 2, null, { timeout: 5000 }).catch(() => {})
  const chapas = await page.$$eval('.lab-chapa-estado', (xs) => xs.map((x) => x.textContent))
  check('el Dedenne enseña sus dos estados en la mesa', chapas.includes('Envenenado') && chapas.includes('Confundido'), JSON.stringify(chapas))
  const etiqueta = await page.$$eval('.lab-slot-activo [data-ver-slot]', (xs) => xs.map((x) => x.getAttribute('aria-label')).find((t) => /^Dedenne/.test(t || '')) || '')
  check('  …y lo dice también para el lector de pantalla', /envenenado/.test(etiqueta || '') && /confundido/.test(etiqueta || ''), etiqueta)
  await page.waitForFunction(() => [...document.querySelectorAll('.lab-slot img')].some((i) => /tcgdex\.net\/en\/sv\/sv05\/087/.test(i.getAttribute('src') || '')), null, { timeout: 8000 }).catch(() => {})
  const src = await page.$$eval('.lab-slot img', (xs) => xs.map((x) => x.getAttribute('src')))
  check('el Dedenne sin `image_path` sale con la ruta de TCGdex a mano, como en Mi colección', src.some((s) => /assets\.tcgdex\.net\/en\/sv\/sv05\/087\/low\.webp/.test(s || '')), JSON.stringify(src))
  check('  …y el Munkidori con su foto puesta a mano, entera (antes salía «assets.tcgdex.net/en/https://…»)', src.includes('https://zqamujmfavwrsqlgbead.supabase.co/storage/v1/object/public/catalogo/munkidori.webp'), JSON.stringify(src))
  check('sin errores en la página', errores.length === 0, errores.join(' | '))
  await page.close()
}
// «Jugar desde aquí» desde un KO: el laboratorio pide coger el premio (es
// obligatorio). Si se cierra sin cogerlo, el botón de la repetición tiene que
// volver: antes se quedaba esperando a esa elección y apagado hasta recargar.
{
  const page = await browser.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.route(/\.(png|webp|jpg)(\?|$)/, (r) => r.abort())
  await page.route(/api\.tcgdex\.net/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await page.addInitScript(() => {
    window.__FAKE_SESSION__ = 'none'
  })
  await page.goto(`${BASE}/repeticiones.html`, { waitUntil: 'domcontentloaded' })
  await page.fill('#repTexto', CAMILLA)
  await page.click('#repFormulario button[type=submit]')
  await page.waitForSelector('#repSala:not(.hidden)')
  await page.evaluate(() => {
    const b = document.querySelector('[data-accion="reproducir"]')
    if (b.getAttribute('aria-label') === 'Pausa') b.click()
  })
  const ev = leerRegistro(CAMILLA).eventos
  const ko = ev.findIndex((e) => e.tipo === 'ko')
  await page.evaluate((n) => {
    const r = document.getElementById('repProgreso')
    r.value = String(n)
    r.dispatchEvent(new Event('input', { bubbles: true }))
  }, ko + 1)
  await page.click('[data-accion="jugar"]')
  const pide = await page.waitForFunction(() => /coge 1 premio/.test(document.querySelector('#labCentro.lab-centro-eligiendo')?.textContent || ''), null, { timeout: 10000 }).then(() => true).catch(() => false)
  check('desde la jugada de un KO, el laboratorio pide coger el premio', pide)
  await page.click('#laboratorio [data-accion="cerrar"]')
  const vuelve = await page.waitForFunction(() => {
    const b = document.querySelector('[data-accion="jugar"]')
    return b && !b.disabled && !b.dataset.abriendo
  }, null, { timeout: 5000 }).then(() => true).catch(() => false)
  check('  …y al cerrarlo sin cogerlo, «Jugar desde aquí» vuelve a estar a mano', vuelve, await page.evaluate(() => JSON.stringify({ disabled: document.querySelector('[data-accion="jugar"]')?.disabled, abriendo: document.querySelector('[data-accion="jugar"]')?.dataset.abriendo })))
  await page.click('[data-accion="jugar"]').catch(() => {})
  const otraVez = await page.waitForSelector('#laboratorio:not([hidden]) .lab-mesa', { timeout: 10000 }).then(() => true).catch(() => false)
  check('  …y se puede volver a abrir', otraVez)
  check('sin errores en la página', errores.length === 0, errores.join(' | '))
  await page.close()
}
await browser.close()

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
