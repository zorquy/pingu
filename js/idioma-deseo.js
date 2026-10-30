// «¿EN QUÉ IDIOMA LA QUIERES?» (tanda 771). PINGU: «la carta que quieras,
// seleccionar el idioma en el que la quieres». El idioma del deseo existe
// en la base desde la 376 (`user_wants.idioma`, null = cualquiera) y los
// cruces ya lo respetan; lo que faltaba era preguntarlo. Una ventana y no
// un desplegable en cada fila: se pregunta UNA vez, al apuntarla, que es
// cuando se sabe.
//
// La comparten /mi-coleccion (el buscador, el Mercado y el corazón de la
// ficha) y /carta (su corazón), y por eso crea su propio <dialog>: /carta no
// lo lleva en su HTML. Su CSS va en css/cardmarket.css, que cargan las dos.
//
// VARIOS IDIOMAS (1128, Sergio.M en el foro) Y VARIAS VERSIONES (1129): los
// dos son casillas y se marcan todos los que valgan; «Cualquiera» va solo en
// cada fila. Cada pareja idioma × versión es un deseo (`combos`, sin las que
// no existen). Para quien aún pregunte por uno, `idioma` y `variante` (los
// primeros). Lo puro, en js/deseo-idiomas.js.
//
// Y LA VERSIÓN (1047, PINGU del foro: «no puedo seleccionar si quiero la
// variante holo o normal»): la misma ventana, una fila más. Solo sale si la
// carta tiene más de una versión que se SABE (las que «¿Cuál tienes?» ofrece
// al añadir) y si la base ya guarda la versión del deseo (migración 1047).
import { IDIOMAS, idiomasParaAnadirEn, idiomasDeLaVersion } from './cardmarket.js'
import { chipDeIdiomaHtml } from './precio-vista.js'
import { idiomasDeSetSinEsperar, reglasDeVersiones, sinReglas } from './idiomas-de-set.js'
import { escapeHtml } from './html.js'
import { variantesDeCarta, seSabenVariantes } from './mi-coleccion/variantes.js'
import { chapaDeVersionHtml } from './mi-coleccion/iconos-version.js'
import { hayVariante } from './deseo-version.js'
import { combosDe } from './deseo-idiomas.js'

// Los del catálogo occidental. Del japonés, `idiomasParaAnadirEn` (911): la
// japonesa y —si su set los tiene— la coreana y la china. El coreano lo
// admite la base desde la migración 911, la misma que dice qué idiomas tiene
// un set: sin ella, del japonés solo llega el japonés.
const OCCIDENTALES = ['es', 'en', 'fr', 'de', 'it', 'pt'].map((id) => IDIOMAS.find((i) => i.id === id))

// '' es «cualquiera»: en el catálogo japonés no se ofrece, porque ahí no hay
// otro idioma que pueda casar. `delSet` (911) quita los que el set no tuvo:
// Plasma Blast no salió en español. Sin saberlo, todos los de antes (y del
// japonés, solo el japonés).
export function opcionesDeDeseo(market = 'WEST', delSet = null) {
  const lista = idiomasParaAnadirEn(market, OCCIDENTALES, delSet)
  return market === 'JP' ? lista : [{ id: '', nombre: 'Cualquiera' }, ...lista]
}

// Lo que se marca de entrada: lo último que elegiste en ese catálogo (1064,
// PINGU: «yo en este caso las quiero en español»); si nunca elegiste,
// «cualquiera», que es lo que más cruces da, o el japonés donde no hay otro.
// Desde la 1128 se recuerdan TODOS, separados por comas («pt,fr»).
const CLAVE_ULTIMO = (market) => `pd-deseo-idioma-${market === 'JP' ? 'JP' : 'WEST'}`
export function idiomaDeEntrada(market = 'WEST') {
  return idiomasDeEntrada(market)[0]
}
export function idiomasDeEntrada(market = 'WEST') {
  try {
    const v = localStorage.getItem(CLAVE_ULTIMO(market))
    if (v !== null) return v ? v.split(',') : ['']
  } catch {}
  return [market === 'JP' ? 'ja' : '']
}
function recordarIdiomas(market, idiomas) {
  try {
    localStorage.setItem(CLAVE_ULTIMO(market), idiomas.filter(Boolean).join(','))
  } catch {}
}

// Las versiones que se ofrecen al desear: las que existen y se saben, como
// en «¿Cuál tienes?» (922). Con una o sin saberlo, ninguna: no hay nada que
// elegir, y ofrecer las cuatro a ciegas sería inventar.
export function versionesParaDesear(carta) {
  if (!carta || !seSabenVariantes(carta)) return []
  const vs = variantesDeCarta(carta).map((v) => ({ id: v.nuestro, nombre: v.nombre }))
  return vs.length > 1 ? vs : []
}

let dialogo = null
// Lo de la apertura en curso: las versiones, las reglas del set y la carta.
let abierta = { versiones: [], reglas: sinReglas(), cardId: null, idiomas: [] }
function crear() {
  if (dialogo) return dialogo
  dialogo = document.createElement('dialog')
  dialogo.className = 'mc-idd'
  dialogo.id = 'iddDialogo'
  dialogo.setAttribute('aria-labelledby', 'iddTitulo')
  dialogo.innerHTML = `
    <div class="mc-idd-cuerpo">
      <h2 id="iddTitulo">¿En qué idioma la quieres?</h2>
      <p class="mc-idd-carta" id="iddCarta"></p>
      <div class="mc-idd-bloque" id="iddIdiomaBloque">
        <p class="mc-idd-rot" id="iddIdiomaRot">Idiomas · marca todos los que te valgan</p>
        <div class="mc-idioma-chips" id="iddChips" role="group" aria-label="Idiomas"></div>
      </div>
      <div class="mc-idd-bloque" id="iddVersionBloque" hidden>
        <p class="mc-idd-rot">Versiones · marca todas las que te valgan</p>
        <div class="mc-idioma-chips" id="iddVersiones" role="group" aria-label="Versiones"></div>
      </div>
      <p class="mc-idd-nota" id="iddNota"></p>
      <div class="mc-idd-pie">
        <button type="button" class="btn-secondary" id="iddCancelar">Cancelar</button>
        <button type="button" class="btn-primary" id="iddApuntar">Apuntar</button>
      </div>
    </div>`
  document.body.append(dialogo)
  dialogo.addEventListener('click', (e) => {
    const version = e.target.closest('[data-variante]')
    if (version) return alternarVersion(version.dataset.variante)
    const chip = e.target.closest('.mc-idioma-chip')
    if (chip && !chip.disabled) alternar(chip.dataset.idioma)
    // Tocar fuera de la caja es cancelar, como en el resto de hojas.
    if (e.target === dialogo) dialogo.close('')
  })
  dialogo.querySelector('#iddCancelar').addEventListener('click', () => dialogo.close(''))
  dialogo.querySelector('#iddApuntar').addEventListener('click', () => dialogo.close('si'))
  return dialogo
}

// Los idiomas marcados (1128). «Cualquiera» ('') va solo: marcarlo quita los
// demás, marcar otro lo quita, y sin ninguno vuelve él (en el japonés, donde
// no hay «cualquiera», se queda el que había).
function marcarIdiomas(ids) {
  for (const x of dialogo.querySelectorAll('#iddChips .mc-idioma-chip')) {
    const puesto = ids.includes(x.dataset.idioma)
    x.classList.toggle('activo', puesto)
    x.setAttribute('aria-checked', String(puesto))
  }
  pintarBoton()
}
function alternar(id) {
  const ahora = idiomasMarcados()
  const hayCualquiera = Boolean(dialogo.querySelector('#iddChips [data-idioma=""]'))
  let nuevos
  if (!id) nuevos = ['']
  else if (ahora.includes(id)) nuevos = ahora.filter((x) => x !== id)
  else nuevos = [...ahora.filter(Boolean), id]
  if (!nuevos.length) nuevos = hayCualquiera ? [''] : [id]
  marcarIdiomas(nuevos)
}

const versionesMarcadas = () => [...dialogo.querySelectorAll('#iddVersiones [data-variante].activo')].map((x) => x.dataset.variante)
const idiomasMarcados = () => [...dialogo.querySelectorAll('#iddChips .mc-idioma-chip.activo')].map((x) => x.dataset.idioma)

// «Apuntar en 2 idiomas», «Apuntar 4 deseos»: que se vea cuántos son.
let textoBoton = 'Apuntar'
function pintarBoton() {
  const n = idiomasMarcados().filter(Boolean).length
  const nv = versionesMarcadas().filter(Boolean).length
  const total = combosMarcados().length
  dialogo.querySelector('#iddApuntar').textContent = nv > 1 ? `${textoBoton} ${total} deseos` : n > 1 ? `${textoBoton} en ${n} idiomas` : textoBoton
}

// Si un idioma vale para una versión (956): «cualquier idioma», siempre.
function valeEn(idioma, variante) {
  const { idiomas, versiones, reglas, cardId } = abierta
  return idiomasDeLaVersion(idiomas, versiones, reglas, variante || null, cardId).includes(idioma)
}
function combosMarcados() {
  const versiones = abierta.versiones.length ? versionesMarcadas() : [null]
  return combosDe({ idiomas: idiomasMarcados(), variantes: versiones }, abierta.market, valeEn)
}

// Los idiomas, con los que no tienen la versión marcada apagados (956, como
// al añadir). «Cualquiera» vale siempre; si el marcado deja de valer, se
// vuelve a «cualquiera» o al primero que sí.
// Con varias versiones marcadas, un idioma vale si sale en ALGUNA (las
// parejas que no existen las quita `combosDe`).
function pintarIdiomas(puestos) {
  const { idiomas, versiones, reglas, cardId } = abierta
  const marcadas = versionesMarcadas()
  const lista = marcadas.length ? marcadas : ['']
  const valen = new Set(lista.flatMap((v) => [...idiomasDeLaVersion(idiomas, versiones, reglas, v || null, cardId)]))
  let elegidos = (Array.isArray(puestos) ? puestos : [puestos]).filter((id) => id != null && valen.has(id))
  if (!elegidos.length) elegidos = [idiomas.find((i) => valen.has(i.id))?.id ?? '']
  const variante = lista[0]
  const nombre = variante ? versiones.find((v) => v.id === variante)?.nombre || variante : ''
  dialogo.querySelector('#iddChips').innerHTML = idiomas
    .map((i) => chipDeIdiomaHtml(i, elegidos.includes(i.id), { noSalio: valen.has(i.id) ? '' : nombre }).replace('role="radio"', 'role="checkbox"'))
    .join('')
  pintarBoton()
}

function marcarVersiones(ids) {
  for (const x of dialogo.querySelectorAll('#iddVersiones [data-variante]')) {
    const puesto = ids.includes(x.dataset.variante)
    x.classList.toggle('activo', puesto)
    x.setAttribute('aria-checked', String(puesto))
  }
  pintarIdiomas(idiomasMarcados())
}
// Como los idiomas: «Cualquiera» ('') va solo y sin ninguna vuelve él.
function alternarVersion(id) {
  const ahora = versionesMarcadas()
  let nuevas
  if (!id) nuevas = ['']
  else if (ahora.includes(id)) nuevas = ahora.filter((x) => x !== id)
  else nuevas = [...ahora.filter(Boolean), id]
  marcarVersiones(nuevas.length ? nuevas : [''])
}

// Con el redondel de la chapa de toda la web (1047c): la Holo naranja aquí
// también.
const chipDeVersionHtml = (v, activo) => `<button type="button" class="mc-idioma-chip mc-idd-version${activo ? ' activo' : ''}" role="checkbox" aria-checked="${activo}" data-variante="${escapeHtml(v.id)}">${v.id ? chapaDeVersionHtml(v.id, { nombre: false, enLinea: true }) : ''}<span>${escapeHtml(v.nombre)}</span></button>`

// Devuelve `{ combos, idiomas, variantes, idioma, variante }` (`null` =
// «cualquiera»; `combos`, las parejas idioma × versión que existen: un deseo
// cada una) o `undefined` si se cancela. `carta` dice las versiones; `puesto`,
// lo que ya tiene un deseo que se cambia (C1: `idiomas`/`variantes` o
// `idioma`/`variante`); `soloVersion`, que el idioma no se toca.
// `varias` (1064): son N cartas a la vez (Seleccionar → «Las quiero», o
// cambiar el idioma de varias): solo el idioma, una vez para todas.
export async function preguntarDeseo({ nombre = '', market = 'WEST', setId = null, carta = null, puesto = null, soloVersion = false, varias = 0 } = {}) {
  const d = crear()
  const versiones = hayVariante() === true ? versionesParaDesear(carta) : []
  const [delSet, reglas] = await Promise.all([
    idiomasDeSetSinEsperar(setId, market),
    versiones.length ? Promise.race([reglasDeVersiones(setId, market), new Promise((ok) => setTimeout(() => ok(sinReglas()), 1500))]) : sinReglas(),
  ])
  const opciones = opcionesDeDeseo(market, delSet)
  // La que ya tiene un deseo, aunque el set ya no la ofrezca (la 472).
  const puestos = puesto ? (puesto.idiomas || [puesto.idioma]).map((i) => i || '') : null
  for (const id of puestos || []) if (id && !opciones.some((i) => i.id === id)) opciones.push(IDIOMAS.find((i) => i.id === id) || { id, nombre: id })
  abierta = { versiones, reglas, cardId: carta?.id || null, idiomas: opciones, market }
  const entrada = puestos || idiomasDeEntrada(market)
  const conVersion = versiones.length > 0
  d.querySelector('#iddTitulo').textContent = varias ? '¿En qué idioma las quieres?' : conVersion || puesto ? '¿Cómo la quieres?' : '¿En qué idioma la quieres?'
  d.querySelector('#iddCarta').textContent = nombre
  d.querySelector('#iddIdiomaBloque').hidden = soloVersion
  d.querySelector('#iddVersionBloque').hidden = !conVersion
  // Las que ya tiene un deseo, aunque la carta ya no las ofrezca.
  const vPuestas = puesto ? (puesto.variantes || [puesto.variante]).map((v) => v || '') : ['']
  const vPuesta = [...versiones, ...vPuestas.filter((v) => v && !versiones.some((x) => x.id === v)).map((v) => ({ id: v, nombre: v }))]
  abierta.versiones = conVersion ? vPuesta : []
  d.querySelector('#iddVersiones').innerHTML = conVersion
    ? [{ id: '', nombre: 'Cualquiera' }, ...vPuesta].map((v) => chipDeVersionHtml(v, vPuestas.includes(v.id))).join('')
    : ''
  textoBoton = puesto ? 'Guardar' : 'Apuntar'
  pintarIdiomas(entrada)
  d.querySelector('#iddNota').textContent = varias
    ? `Para las ${varias}. Marca todos los idiomas que te valgan; «Cualquiera» te cruza con más gente.`
    : soloVersion
    ? 'La quieres en varios idiomas: aquí cambias la versión.'
    : market === 'JP'
      ? (opciones.length > 1 ? 'Del catálogo japonés, en los idiomas en los que salió. Puedes marcar varios.' : 'Del catálogo japonés solo existe en japonés.')
      : conVersion
        ? 'Marca todos los idiomas y versiones que te valgan: es un deseo por cada pareja. «Cualquiera» te cruza con más gente.'
        : 'Marca todos los idiomas que te valgan: es un deseo por idioma. «Cualquiera» te cruza con más gente.'
  d.returnValue = ''
  return new Promise((resolver) => {
    d.addEventListener('close', () => {
      if (d.returnValue !== 'si') return resolver(undefined)
      const marcados = idiomasMarcados()
      const idiomas = soloVersion ? (puesto?.idiomas || [puesto?.idioma ?? null]) : (marcados.length ? marcados : entrada).map((i) => i || null)
      if (!soloVersion) recordarIdiomas(market, idiomas)
      const limpios = idiomas.includes(null) ? [null] : idiomas
      const fuera = puesto ? (puesto.variantes || [puesto.variante ?? null]) : [null]
      const variantes = conVersion ? (versionesMarcadas().length ? versionesMarcadas() : ['']).map((v) => v || null) : fuera
      const combos = soloVersion ? combosDe({ idiomas: limpios, variantes }, market) : conVersion ? combosMarcados() : combosDe({ idiomas: limpios, variantes }, market)
      resolver({ idiomas: limpios, idioma: limpios[0], variantes, variante: variantes[0] ?? null, combos })
    }, { once: true })
    d.showModal()
    d.querySelector('.mc-idioma-chip.activo')?.focus()
  })
}

// Lo de antes (771), para quien solo pregunta el idioma: el idioma ('es',
// 'ja'…), `null` para «cualquiera» o `undefined` si se cancela.
export async function preguntarIdioma(opciones = {}) {
  const r = await preguntarDeseo({ ...opciones, carta: null })
  return r === undefined ? undefined : r.idioma
}
