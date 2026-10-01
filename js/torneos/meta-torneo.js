// El META de un torneo (tanda 413). PINGU: «un apartado en cada torneo
// para ver cuál ha sido el meta: los mazos que se han jugado con sus
// porcentajes, y si entras en un arquetipo, los jugadores que lo han
// usado, con su lista y su resultado en orden».
//
// Sale de lo que la ficha YA tiene: los arquetipos se deducen de las
// listas que la base deja leer (tanda 230) y la clasificación del motor.
// Así que aparece exactamente cuando las listas se pueden ver —al
// terminar el torneo, o en juego si es de lista abierta— y ni un minuto
// antes. No se guarda nada.
//
// `agruparMeta` es pura (sin DOM ni base) y se prueba en Node; el pintado
// va debajo y lo monta ronda.js con lo que ya tiene a mano.
import { escapeHtml } from '../app.js'
import { icons } from '../icons.js'
import { claveDeArquetipo, dexesDeNombre } from './arquetipos.js'

// La clave del META es el Pokémon PRINCIPAL del mazo, no el arquetipo
// entero (tanda 421). PINGU: «hay arquetipos que se repiten y aparecen
// por separado, no tiene sentido». En la Copa RyuCards salían 24 filas
// para 32 jugadores: «N's Zoroark ex N's Darmanitan», «N's Zoroark ex
// Pecharunt ex», «N's Zoroark ex Munkidori», «N's Zoroark ex» a secas y
// «Zoroark ex de N Darmanitan de N» (el mismo mazo exportado en español)
// eran cinco filas de un jugador para lo que es UN mazo con seis. El
// segundo icono que se deduce es la pareja o la carta técnica de cada
// uno, y partía el meta en variantes.
//
// El principal es el primer icono (el que más pesa en la lista) y se
// compara por su ESPECIE (`dexesDeNombre`, que entiende el inglés y el
// español), así que el idioma tampoco parte nada. Una Mega no es la
// básica: «Mega Lucario ex» y «Lucario» tienen especies distintas. Un mazo
// cuyo principal no es un Pokémon (los «Martillos») se agrupa como antes.
export function claveDelMeta(arq) {
  if (!arq) return 'sin-mazo'
  const principal = arq.iconos?.[0]
  const dex = dexesDeNombre(principal?.nombre ?? principal?.name ?? '')[0]
  return dex ? `p:${dex}` : claveDeArquetipo(arq)
}

// Dos jugadores llevan la MISMA variante si sus iconos son los mismos
// Pokémon (por especie: el mismo mazo exportado en inglés y en español
// no son dos variantes) o, si un icono es un objeto, el mismo objeto.
function claveDeVariante(arq) {
  if (arq.id) return `a:${arq.id}`
  const partes = (arq.iconos || []).map((i) => {
    const nombre = String(i?.nombre ?? i?.name ?? '')
    return String(dexesDeNombre(nombre)[0] ?? nombre.trim().toLowerCase())
  })
  return partes.length ? partes.sort().join('|') : claveDeArquetipo(arq)
}

// Cómo se enseña un grupo. Si todos jugaron exactamente lo mismo, su
// arquetipo tal cual (con sus dos iconos). Si hay variantes, el
// principal solo —con el nombre que más se repite; a igualdad, el de
// quien quedó más arriba— y la lista de variantes aparte, para no
// perder qué jugó cada uno.
function representar(jugadores) {
  const porVariante = new Map()
  for (const j of jugadores) {
    const clave = claveDeVariante(j.arq)
    if (!porVariante.has(clave)) porVariante.set(clave, { nombre: j.arq.nombre, cuantos: 0 })
    porVariante.get(clave).cuantos++
  }
  if (porVariante.size === 1) return { arq: jugadores[0].arq, variantes: [] }
  const nombres = new Map()
  for (const j of jugadores) {
    const icono = j.arq.iconos?.[0]
    const nombre = icono?.nombre ?? icono?.name
    if (!nombre) continue
    if (!nombres.has(nombre)) nombres.set(nombre, { cuantos: 0, icono })
    nombres.get(nombre).cuantos++
  }
  // sort es estable: a igual cuenta, el primero que apareció (los
  // jugadores ya vienen en el orden de la clasificación).
  const [nombre, { icono }] = [...nombres].sort((a, b) => b[1].cuantos - a[1].cuantos)[0]
  return {
    arq: { id: null, nombre, iconos: [icono], curado: jugadores.every((j) => j.arq.curado) },
    variantes: [...porVariante.values()].sort((a, b) => b.cuantos - a.cuantos),
  }
}

// arquetipos: Map userId → { id, nombre, iconos, curado } (los que tienen lista)
// tabla: la clasificación del motor, ya ordenada ({ playerId, matchPoints,
//   wins, losses, draws, … }).
//
// Devuelve los arquetipos de más a menos jugado (a igualdad, el que
// quedó más arriba), cada uno con sus jugadores EN EL ORDEN DE LA
// CLASIFICACIÓN. Quien tiene lista y no sale en la tabla (se inscribió y
// no llegó a jugar) cuenta para el meta y va al final.
export function agruparMeta(arquetipos, tabla) {
  const puestoDe = new Map((tabla || []).map((e, i) => [e.playerId, { puesto: i + 1, e }]))
  const grupos = new Map()
  for (const [userId, arq] of arquetipos || []) {
    if (!arq) continue
    const clave = claveDelMeta(arq)
    if (!grupos.has(clave)) grupos.set(clave, { clave, jugadores: [] })
    const p = puestoDe.get(userId)
    grupos.get(clave).jugadores.push({ userId, arq, puesto: p?.puesto ?? null, e: p?.e ?? null })
  }
  const total = [...grupos.values()].reduce((n, g) => n + g.jugadores.length, 0)
  const conPuesto = (a, b) => (a.puesto ?? Infinity) - (b.puesto ?? Infinity)
  const fuera = [...grupos.values()].map((g) => {
    g.jugadores.sort(conPuesto)
    const suma = (k) => g.jugadores.reduce((n, j) => n + (j.e?.[k] || 0), 0)
    // Los byes fuera: el motor los cuenta como victorias (para los
    // puntos), pero un bye no dice NADA de cómo juega un mazo, y con
    // impares le regalaría el porcentaje a quien le tocó.
    const victorias = suma('wins') - suma('byesReceived')
    const partidas = victorias + suma('losses') + suma('draws')
    return {
      ...g,
      ...representar(g.jugadores),
      cuantos: g.jugadores.length,
      cuota: total ? g.jugadores.length / total : 0,
      mejorPuesto: g.jugadores[0]?.puesto ?? null,
      victorias,
      derrotas: suma('losses'),
      empates: suma('draws'),
      // El % de victorias del arquetipo entero: partidas ganadas entre
      // jugadas (los empates cuentan como jugadas, no como ganadas).
      porcentajeVictorias: partidas ? victorias / partidas : null,
    }
  })
  fuera.sort((a, b) => b.cuantos - a.cuantos || (a.mejorPuesto ?? Infinity) - (b.mejorPuesto ?? Infinity) || a.arq.nombre.localeCompare(b.arq.nombre, 'es'))
  return { total, arquetipos: fuera }
}

// El ORDEN FINAL del torneo, que no es la clasificación de las suizas
// cuando hay corte: quien gana el top 8 pudo entrar octavo. Se ordena por
// hasta dónde llegó cada uno en el corte (la ronda más alta que jugó; el
// campeón, una más) y, a igualdad, por las suizas — que es como se
// reparten los puestos en un torneo de verdad.
//
// rondas: [{ id, phase, round_number }], partidas: [{ round_id,
// player_a_id, player_b_id }], campeon: userId o null.
export function ordenFinal(tabla, { rondas = [], partidas = [], campeon = null } = {}) {
  const delCorte = new Map(rondas.filter((r) => r.phase === 'top_cut').map((r) => [r.id, r.round_number]))
  if (!delCorte.size) return tabla
  const alcance = new Map()
  for (const m of partidas) {
    const n = delCorte.get(m.round_id)
    if (n === undefined) continue
    for (const j of [m.player_a_id, m.player_b_id]) if (j) alcance.set(j, Math.max(alcance.get(j) || 0, n))
  }
  if (campeon) alcance.set(campeon, Math.max(0, ...alcance.values()) + 1)
  // sort es estable: a igual alcance se queda el orden de las suizas.
  return [...tabla].sort((a, b) => (alcance.get(b.playerId) || 0) - (alcance.get(a.playerId) || 0))
}

const pct = (x) => `${(x * 100).toFixed(x > 0 && x < 0.1 ? 1 : 0).replace('.', ',')} %`
const ordinal = (n) => (n ? `${n}.º` : '—')

// ── El pintado ──
//
// `ayudas` = { chapa(arq) → html, nombreDe(userId), enJuego, exportar } para no
// traerse aquí media ronda.js. El nombre del mazo va APARTE de la chapa:
// la chapa lo esconde cuando tiene iconos, y aquí el nombre es el dato.
export function metaHtml(meta, abierto, ayudas) {
  if (!meta.arquetipos.length) return '<p class="subtext">Todavía no hay listas que mirar.</p>'
  const elegido = abierto ? meta.arquetipos.find((g) => g.clave === abierto) : null
  if (elegido) return detalleHtml(elegido, meta, ayudas)
  const filas = meta.arquetipos
    .map(
      (g) => `
      <li>
        <button type="button" class="torneo-meta-fila" data-meta-arquetipo="${escapeHtml(g.clave)}">
          <span class="torneo-meta-mazo">${ayudas.chapa(g.arq)}</span>
          <span class="torneo-meta-datos">
            <span class="torneo-meta-nombre">${escapeHtml(g.arq.nombre)}</span>
            <span class="torneo-meta-barra" aria-hidden="true"><span style="--parte: ${(g.cuota * 100).toFixed(1)}%"></span></span>
            <span class="subtext">${g.cuantos} ${g.cuantos === 1 ? 'jugador' : 'jugadores'}${g.variantes.length ? ` · ${g.variantes.length} variantes` : ''} · mejor puesto ${ordinal(g.mejorPuesto)}${g.porcentajeVictorias !== null ? ` · ${pct(g.porcentajeVictorias)} de victorias` : ''}</span>
          </span>
          <strong class="torneo-meta-cuota">${pct(g.cuota)}</strong>
        </button>
      </li>`
    )
    .join('')
  // La imagen para compartir (tanda 425): solo quien lleva el torneo y
  // solo terminado, que es cuando el meta ya no cambia.
  const imagen = ayudas.exportar
    ? `<button type="button" class="btn-secondary torneo-meta-imagen" data-meta-imagen>${icons.image(16)} Descargar imagen del meta</button>`
    : ''
  return `
    <div class="torneo-meta-resumen">
      <p class="subtext">${meta.total} ${meta.total === 1 ? 'lista' : 'listas'} · ${meta.arquetipos.length} ${meta.arquetipos.length === 1 ? 'mazo distinto' : 'mazos distintos'}.${ayudas.enJuego ? ' El torneo sigue en juego: los puestos van cambiando.' : ''} Pulsa uno para ver quién lo jugó.</p>
      ${imagen}
    </div>
    <ul class="torneo-meta-lista">${filas}</ul>`
}

// Una fila por jugador y no una tabla: con cinco columnas, en el móvil el
// «Ver lista» se quedaba fuera de la pantalla, que es justo lo que se
// viene a pulsar aquí.
function detalleHtml(g, meta, ayudas) {
  const filas = g.jugadores
    .map((j) => {
      const nombre = escapeHtml(ayudas.nombreDe(j.userId))
      const resultado = j.e
        ? `${j.e.wins}-${j.e.losses}-${j.e.draws}${j.e.byesReceived ? ` (+${j.e.byesReceived} bye)` : ''} · ${j.e.matchPoints} ${j.e.matchPoints === 1 ? 'punto' : 'puntos'}`
        : 'Sin partidas'
      return `
      <li class="torneo-meta-jugador">
        <span class="torneo-pos${j.puesto && j.puesto <= 3 ? ` torneo-pos-${j.puesto}` : ''}"><span class="sr-only">Puesto </span>${j.puesto ?? '—'}</span>
        <span class="torneo-meta-quien"><strong>${nombre}</strong>${g.variantes.length ? `<span class="torneo-meta-variante">${escapeHtml(j.arq.nombre)}</span>` : ''}<span class="subtext">${resultado}</span></span>
        <button type="button" class="btn-secondary torneo-ver-lista" data-meta-lista="${escapeHtml(j.userId)}" aria-label="Ver lista de ${nombre}">Ver lista</button>
      </li>`
    })
    .join('')
  return `
    <button type="button" class="link-btn torneo-meta-volver" data-meta-volver>← Todo el meta</button>
    <div class="torneo-meta-cabecera">
      <span class="torneo-meta-mazo">${ayudas.chapa(g.arq)}</span>
      <h4 class="torneo-meta-nombre">${escapeHtml(g.arq.nombre)}</h4>
      ${
        g.variantes.length
          ? `<p class="subtext torneo-meta-variantes">Variantes: ${g.variantes.map((v) => `${escapeHtml(v.nombre)}${v.cuantos > 1 ? ` ×${v.cuantos}` : ''}`).join(' · ')}</p>`
          : ''
      }
      <span class="subtext">${g.cuantos} de ${meta.total} ${meta.total === 1 ? 'lista' : 'listas'} (${pct(g.cuota)}) · ${g.victorias}-${g.derrotas}-${g.empates} entre todos, sin contar byes</span>
    </div>
    <ol class="torneo-meta-jugadores">${filas}</ol>`
}
