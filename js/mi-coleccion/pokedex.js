// La Pokédex de «Mi colección» (tanda 381).
//
// PINGU, sobre la app de TCGdex: «me gustaría hacer algo como lo que
// tienen ellos incrustado en Pokédex». Es lo que convierte un listado de
// cartas en una colección: **la gente no colecciona sets, colecciona
// Pokémon.** Entras en Pikachu y ves sus 300 cartas, de todas las
// colecciones, con cuáles tienes.
//
// ── QUÉ SE PREGUNTA Y QUÉ NO ──
//
// Lo que TIENES no se consulta: la página ya lleva tu colección en
// memoria, y de qué Pokémon es cada carta sale de su NOMBRE con
// `especiesDeCarta`. O sea que la rejilla de las 1.025 especies con tu
// progreso se pinta **sin una sola consulta**.
//
// Lo que sí se pregunta es cuántas hay EN EL CATÁLOGO de cada una
// (`pokedex_resumen`, una vez por visita) y, al abrir una especie, sus
// cartas. Y las dos degradan: sin la migración puesta la pestaña enseña
// lo tuyo y dice qué falta, en vez de salir vacía.
//
// Este módulo entra por `import()` y no se carga hasta que abres la
// pestaña: se trae `sprites-pokemon.js`, que son los 1.025 nombres.
import { escapeHtml } from '../html.js'
import { rutaDeCarta } from '../carta-ruta.js'
import { cadenaDeEscaneo, atributosDeEscaneo } from '../escaneo-carta.js'
import { especiesDeCarta, especiePorDex, POKEMON_POR_DEX } from '../pokedex-especies.js'
import { urlDeSprite, atributosDeRespaldo } from '../torneos/sprites-pokemon.js'

const nombreDe = (c) => c?.name_es || c?.name || 'Carta'

// ── Lo que tienes, por especie ──
//
// De tus líneas y del mapa de cartas que la página ya tiene. Cuenta
// cartas DISTINTAS y no copias: una Pokédex se llena por Pokémon, y
// tres Charizards iguales son un Charizard.
//
// Una carta puede caer en DOS especies (las TAG TEAM), y entonces cuenta
// en las dos: si tienes «Pikachu & Zekrom-GX», tienes un Pikachu y
// tienes un Zekrom. Eso no es contar de más — es lo que la carta enseña.
export function loMioPorEspecie(lineas, cartas) {
  const porDex = new Map()
  const vistas = new Set()
  for (const l of lineas || []) {
    if (vistas.has(l.card_id)) continue
    vistas.add(l.card_id)
    const carta = cartas.get(l.card_id)
    if (!carta) continue
    for (const dex of especiesDeCarta(carta.name || carta.name_es)) {
      porDex.set(dex, (porDex.get(dex) || 0) + 1)
    }
  }
  return porDex
}

// ¿Esta carta es de esta especie? Se pregunta por el NOMBRE y no por
// `dex_ids`, porque mientras la columna se esté rellenando las cartas
// que tienes no la traen todavía — y son justo las que no pueden
// faltar en la pantalla.
export function esDeLaEspecie(carta, dex) {
  return especiesDeCarta(carta?.name || carta?.name_es).includes(Number(dex))
}

// ── Las filas de la rejilla ──
//
// `total` es null cuando no se sabe (sin migración, o una especie de la
// que el catálogo todavía no ha contado nada). `null` y `0` son cosas
// distintas y la pantalla dice cuál es — la lección de la 319.
export function filasDePokedex({ mio, totales, soloMios = false, texto = '' }) {
  const busca = String(texto || '').trim().toLowerCase()
  const filas = []
  for (let dex = 1; dex <= POKEMON_POR_DEX.length; dex++) {
    const tengo = mio.get(dex) || 0
    if (soloMios && !tengo) continue
    const nombre = POKEMON_POR_DEX[dex - 1]
    if (busca && !nombre.toLowerCase().includes(busca) && String(dex) !== busca) continue
    filas.push({ dex, nombre, tengo, total: totales.has(dex) ? totales.get(dex) : null })
  }
  return filas
}

function filaHtml(f) {
  const sprite = urlDeSprite(f.dex)
  const pct = f.total ? Math.min(100, Math.round((f.tengo / f.total) * 100)) : 0
  const completo = f.total && f.tengo >= f.total
  return `
    <button type="button" class="pdx-especie${f.tengo ? ' tengo' : ''}${completo ? ' completo' : ''}" data-dex="${f.dex}">
      <span class="pdx-sprite">${
        sprite ? `<img src="${escapeHtml(sprite)}" alt="" width="68" height="56" loading="lazy" decoding="async"${atributosDeRespaldo(sprite)} />` : ''
      }</span>
      <span class="pdx-num">N.º ${String(f.dex).padStart(4, '0')}</span>
      <span class="pdx-nombre">${escapeHtml(f.nombre)}</span>
      <span class="pdx-cuenta">${
        f.total === null
          ? f.tengo
            ? `${f.tengo} ${f.tengo === 1 ? 'carta' : 'cartas'}`
            : '—'
          : `${f.tengo} de ${f.total}`
      }</span>
      ${f.total ? `<span class="mc-barra" role="presentation"><i style="--i:${pct}%"></i></span>` : ''}
    </button>`
}

export function rejillaHtml(filas) {
  if (!filas.length) {
    return '<p class="empty-state">Ningún Pokémon con ese nombre.</p>'
  }
  return `<div class="pdx-rejilla">${filas.map(filaHtml).join('')}</div>`
}

// ── Una especie abierta ──
//
// `tuyas` es el conjunto de identificadores que tienes, para marcarlas.
// Las que no tienes salen en gris, igual que los bolsillos vacíos del
// álbum: es el mismo gesto y no hay que aprender otro.
export function especieHtml({ dex, cartas, tuyas, sinCatalogo = false }) {
  const nombre = especiePorDex(dex) || `N.º ${dex}`
  const sprite = urlDeSprite(dex)
  const tengo = cartas.filter((c) => tuyas.has(c.id)).length
  const cuerpo = cartas.length
    ? `<div class="pdx-cartas">${cartas
        .map((c) => {
          const escaneo = atributosDeEscaneo(cadenaDeEscaneo(c))
          const mia = tuyas.has(c.id)
          return `<a class="pdx-carta${mia ? ' tengo' : ''}" href="${escapeHtml(rutaDeCarta(c))}" title="${escapeHtml(nombreDe(c))} — ${escapeHtml(c.tcg_sets?.name || c.set_id)}">
            ${escaneo ? `<img ${escaneo} alt="${escapeHtml(nombreDe(c))}" width="245" height="342" loading="lazy" />` : ''}
            <span class="pdx-carta-set">${escapeHtml(c.tcg_sets?.name || c.set_id)}</span>
          </a>`
        })
        .join('')}</div>`
    : sinCatalogo
      ? '<p class="empty-state">El catálogo todavía no sabe de qué Pokémon habla cada carta. En cuanto termine de repasarlo, aquí saldrán todas las de este Pokémon.</p>'
      : '<p class="empty-state">No hay ninguna carta de este Pokémon en el catálogo.</p>'
  return `
    <div class="pdx-cabecera">
      <!-- La flecha en texto, como el «← Todas las colecciones» del
           álbum: no hay icono de flecha en js/icons.js y meterlo solo
           para esto sería añadir un dibujo a la hoja que baja todo el
           mundo. Y así los dos botones de volver se leen igual. -->
      <button type="button" class="link-btn mc-album-volver" id="pdxVolver">← Todos los Pokémon</button>
      <span class="pdx-sprite pdx-sprite-grande">${
        sprite ? `<img src="${escapeHtml(sprite)}" alt="" width="96" height="80"${atributosDeRespaldo(sprite)} />` : ''
      }</span>
      <div>
        <h3>${escapeHtml(nombre)}</h3>
        <p class="subtext">N.º ${String(dex).padStart(4, '0')}${
          cartas.length ? ` · tienes ${tengo} de ${cartas.length}` : ''
        }</p>
      </div>
    </div>
    ${cuerpo}`
}
