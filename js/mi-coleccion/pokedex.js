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

// La barra va con `--ancho`, que es la variable que lee `.mc-barra i` en
// la hoja y la que escriben las otras cuatro barras de esta página. Con
// `--i` se pinta SIEMPRE al 0 % y no da ningún error: se lee como
// «todavía no tengo ninguna» en los 1.025. Lo vigila test-tanda-382,
// que barre TODAS las barras del sitio y no solo esta.
//
// (Y el comentario va AQUÍ y no dentro del HTML de abajo: un comentario
// con acentos graves METIDO EN UNA PLANTILLA la termina, y el fichero
// deja de parsear. Es la segunda vez esta semana.)
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
      ${f.total ? `<span class="mc-barra" role="presentation"><i style="--ancho:${pct}%"></i></span>` : ''}
    </button>`
}

// ── Por generaciones (tanda 414) ──
//
// Mil veinticinco casillas seguidas no son una lista, son un muro: no hay
// forma de saber por dónde vas ni de llegar a «los de Hoenn» sin
// desplazarse a ojo. En la app de Dex están agrupados por generación y
// con su cuenta al lado, y eso es lo que convierte el muro en un índice.
//
// **La última no tiene final.** Las ocho primeras son rangos cerrados que
// no van a cambiar nunca, pero la novena sí: el día que salga la décima,
// una lista cerrada dejaría a los nuevos FUERA de todos los grupos y
// desaparecerían de la pantalla sin dar error. Así, caen en la última.
const GENERACIONES = [
  { nombre: 'Primera generación', desde: 1, hasta: 151 },
  { nombre: 'Segunda generación', desde: 152, hasta: 251 },
  { nombre: 'Tercera generación', desde: 252, hasta: 386 },
  { nombre: 'Cuarta generación', desde: 387, hasta: 493 },
  { nombre: 'Quinta generación', desde: 494, hasta: 649 },
  { nombre: 'Sexta generación', desde: 650, hasta: 721 },
  { nombre: 'Séptima generación', desde: 722, hasta: 809 },
  { nombre: 'Octava generación', desde: 810, hasta: 905 },
  { nombre: 'Novena generación', desde: 906, hasta: Infinity },
]

export function porGeneraciones(filas) {
  const grupos = GENERACIONES.map((g) => ({ ...g, filas: [] }))
  for (const f of filas) {
    const g = grupos.find((x) => f.dex >= x.desde && f.dex <= x.hasta)
    if (g) g.filas.push(f)
  }
  // Un rótulo encima de nada es ruido: con un buscador puesto, la mayoría
  // de las generaciones se quedan vacías.
  return grupos.filter((g) => g.filas.length)
}

export function rejillaHtml(filas) {
  if (!filas.length) {
    return '<p class="empty-state">Ningún Pokémon con ese nombre.</p>'
  }
  return porGeneraciones(filas)
    .map((g) => {
      const tengo = g.filas.filter((f) => f.tengo).length
      return `<h3 class="pdx-generacion">
          <span>${escapeHtml(g.nombre)}</span>
          <small>${tengo} de ${g.filas.length}</small>
        </h3>
        <div class="pdx-rejilla">${g.filas.map(filaHtml).join('')}</div>`
    })
    .join('')
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
          // Sin escaneo, el NOMBRE y el número en el hueco (tanda 415).
          // PINGU: «hay un montón de cartas en la colección que no se
          // muestran y no sé por qué». No hay por qué: TCGdex es un
          // catálogo comunitario y a esas cartas no les han subido la
          // foto, y de Limitless solo se puede sacar si la colección
          // tiene código de TCG Live. Lo que no puede ser es que el hueco
          // se quede vacío: un sitio en blanco se lee como un fallo, y
          // una carta con su nombre escrito se lee como una carta.
          return `<a class="pdx-carta${mia ? ' tengo' : ''}" href="${escapeHtml(rutaDeCarta(c))}" data-carta="${escapeHtml(c.id)}" title="${escapeHtml(nombreDe(c))} — ${escapeHtml(c.tcg_sets?.name || c.set_id)}">
            ${
              escaneo
                ? `<img ${escaneo} alt="${escapeHtml(nombreDe(c))}" width="245" height="342" loading="lazy" />`
                : `<span class="mc-carta-sinfoto">${escapeHtml(nombreDe(c))}${c.local_id ? `<small>${escapeHtml(c.local_id)}</small>` : ''}</span>`
            }
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

// ── La cabecera de la Pokédex (tanda 400) ──
//
// PINGU, enseñando Dex: arriba de su Pokédex hay cuatro cifras —cuántos
// llevas, cuántos has COMPLETADO, el que más tienes y el que menos— y
// aquí solo había un «X de 1.025» en letra pequeña.
//
// «Completado» es tener TODAS las cartas que el catálogo conoce de esa
// especie. Hace falta saber el total, así que una especie de la que no
// se sabe cuántas hay no cuenta ni como completada ni como pendiente:
// no se sabe, que no es lo mismo que cero (la regla de la 319).
//
// Puro: `mio` es un Map dex → cuántas tienes, `totales` otro dex →
// cuántas hay. Se prueba en Node.
export function resumenDePokedex({ mio = new Map(), totales = new Map(), total = 1025 } = {}) {
  let registrados = 0
  let completados = 0
  let masDex = null
  let menosDex = null
  for (const [dex, n] of mio) {
    if (!n) continue
    registrados++
    const hay = totales.get(dex)
    if (hay && n >= hay) completados++
    if (masDex === null || n > mio.get(masDex)) masDex = dex
    // El que MENOS tienes es entre los que tienes: un cero no es «poco»,
    // es que no lo tienes, y para eso ya está lo que falta.
    if (menosDex === null || n < mio.get(menosDex)) menosDex = dex
  }
  return {
    registrados,
    total,
    completados,
    // null y no {dex: 0}: con la Pokédex vacía no hay «el que más», y
    // enseñar a Bulbasaur con un 0 sería inventarlo.
    mas: masDex === null ? null : { dex: masDex, cuantas: mio.get(masDex) },
    menos: menosDex === null ? null : { dex: menosDex, cuantas: mio.get(menosDex) },
  }
}

// La cabecera pintada. Las tarjetas que no tienen nada que decir —con la
// Pokédex vacía, «el que más» y «el que menos»— no se pintan: una
// tarjeta con una raya ocupa lo mismo que el dato.
export function cabeceraHtml(resumen, { nombreDe = (d) => `#${d}` } = {}) {
  // Con un decimal por debajo del 10 %: 2 de 1.025 redondeado da «0 %»,
  // que parece que no tienes nada cuando sí tienes. Y el total con punto
  // de millar, que «1025» se lee como un número de carta.
  const crudo = resumen.total ? (resumen.registrados / resumen.total) * 100 : 0
  const pct = crudo > 0 && crudo < 10 ? crudo.toFixed(1).replace('.', ',') : Math.round(crudo)
  // : en español los números de cuatro cifras no
  // se agrupan por defecto, así que 1025 salía sin punto y se leía como
  // un número de carta.
  // `useGrouping: 'always'`: en español los números de cuatro cifras no se
  // agrupan por defecto, así que 1025 salía sin punto y se leía como un
  // número de carta.
  const miles = (n) => new Intl.NumberFormat('es-ES', { useGrouping: 'always' }).format(n)
  const tarjeta = (rotulo, cifra, pie) =>
    `<div class="mc-pdx-caja"><p class="mc-pdx-rotulo">${escapeHtml(rotulo)}</p><p class="mc-pdx-cifra">${escapeHtml(String(cifra))}</p><p class="mc-pdx-pie">${escapeHtml(pie)}</p></div>`
  // El anillo (tanda 414). Es el mismo dato que el pie —el porcentaje—,
  // pero un número suelto no dice si vas por la mitad o por el final; un
  // anillo sí, de un vistazo y sin leer. Va con `conic-gradient`, sin
  // dependencias ni dibujo: es un fondo.
  const anillo = `<span class="mc-anillo" style="--pct:${crudo.toFixed(1)}" role="img" aria-label="${escapeHtml(String(pct))} % registrado"><b>${escapeHtml(String(pct))} %</b></span>`
  return `<div class="mc-pdx-cabecera">
    <div class="mc-pdx-caja mc-pdx-principal">
      <div>
        <p class="mc-pdx-rotulo">Registrados</p>
        <p class="mc-pdx-cifra">${resumen.registrados}</p>
        <p class="mc-pdx-pie">de ${escapeHtml(miles(resumen.total))}</p>
      </div>
      ${anillo}
    </div>
    ${tarjeta('Completados', `${resumen.completados}`, 'con todas sus cartas')}
    ${resumen.mas ? tarjeta('El que más tienes', `${resumen.mas.cuantas}`, nombreDe(resumen.mas.dex)) : ''}
    ${resumen.menos ? tarjeta('El que menos', `${resumen.menos.cuantas}`, nombreDe(resumen.menos.dex)) : ''}
  </div>`
}

