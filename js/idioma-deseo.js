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

// Lo que se marca de entrada: «cualquiera», que es lo que más cruces da, o
// el japonés donde no hay otro.
export const idiomaDeEntrada = (market = 'WEST') => (market === 'JP' ? 'ja' : '')

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
        <p class="mc-idd-rot" id="iddIdiomaRot" hidden>Idioma</p>
        <div class="mc-idioma-chips" id="iddChips" role="radiogroup" aria-label="Idioma"></div>
      </div>
      <div class="mc-idd-bloque" id="iddVersionBloque" hidden>
        <p class="mc-idd-rot">Versión</p>
        <div class="mc-idioma-chips" id="iddVersiones" role="radiogroup" aria-label="Versión"></div>
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
    if (version) return marcarVersion(version.dataset.variante)
    const chip = e.target.closest('.mc-idioma-chip')
    if (chip && !chip.disabled) marcar(chip.dataset.idioma)
    // Tocar fuera de la caja es cancelar, como en el resto de hojas.
    if (e.target === dialogo) dialogo.close('')
  })
  dialogo.querySelector('#iddCancelar').addEventListener('click', () => dialogo.close(''))
  dialogo.querySelector('#iddApuntar').addEventListener('click', () => dialogo.close('si'))
  return dialogo
}

function marcar(id) {
  for (const x of dialogo.querySelectorAll('#iddChips .mc-idioma-chip')) {
    const puesto = x.dataset.idioma === id
    x.classList.toggle('activo', puesto)
    x.setAttribute('aria-checked', String(puesto))
  }
}

const versionMarcada = () => dialogo.querySelector('#iddVersiones .activo')?.dataset.variante || ''
const idiomaMarcado = () => dialogo.querySelector('#iddChips .mc-idioma-chip.activo')?.dataset.idioma

// Los idiomas, con los que no tienen la versión marcada apagados (956, como
// al añadir). «Cualquiera» vale siempre; si el marcado deja de valer, se
// vuelve a «cualquiera» o al primero que sí.
function pintarIdiomas(puesto) {
  const { idiomas, versiones, reglas, cardId } = abierta
  const variante = versionMarcada()
  const valen = new Set(idiomasDeLaVersion(idiomas, versiones, reglas, variante || null, cardId))
  const elegido = valen.has(puesto) ? puesto : idiomas.find((i) => valen.has(i.id))?.id ?? ''
  const nombre = variante ? versiones.find((v) => v.id === variante)?.nombre || variante : ''
  dialogo.querySelector('#iddChips').innerHTML = idiomas.map((i) => chipDeIdiomaHtml(i, i.id === elegido, { noSalio: valen.has(i.id) ? '' : nombre })).join('')
}

function marcarVersion(id) {
  for (const x of dialogo.querySelectorAll('#iddVersiones [data-variante]')) {
    const puesto = x.dataset.variante === id
    x.classList.toggle('activo', puesto)
    x.setAttribute('aria-checked', String(puesto))
  }
  pintarIdiomas(idiomaMarcado())
}

// Con el redondel de la chapa de toda la web (1047c): la Holo naranja aquí
// también.
const chipDeVersionHtml = (v, activo) => `<button type="button" class="mc-idioma-chip mc-idd-version${activo ? ' activo' : ''}" role="radio" aria-checked="${activo}" data-variante="${escapeHtml(v.id)}">${v.id ? chapaDeVersionHtml(v.id, { nombre: false, enLinea: true }) : ''}<span>${escapeHtml(v.nombre)}</span></button>`

// Devuelve `{ idioma, variante }` (los dos `null` = «cualquiera») o
// `undefined` si se cancela. `carta` dice las versiones; `puesto`, lo que ya
// tiene un deseo que se cambia (C1); `soloVersion`, que el idioma no se toca
// (un deseo apuntado en varios idiomas cambia de versión, no de idioma).
export async function preguntarDeseo({ nombre = '', market = 'WEST', setId = null, carta = null, puesto = null, soloVersion = false } = {}) {
  const d = crear()
  const versiones = hayVariante() === true ? versionesParaDesear(carta) : []
  const [delSet, reglas] = await Promise.all([
    idiomasDeSetSinEsperar(setId, market),
    versiones.length ? Promise.race([reglasDeVersiones(setId, market), new Promise((ok) => setTimeout(() => ok(sinReglas()), 1500))]) : sinReglas(),
  ])
  const opciones = opcionesDeDeseo(market, delSet)
  // La que ya tiene un deseo, aunque el set ya no la ofrezca (la 472).
  if (puesto?.idioma && !opciones.some((i) => i.id === puesto.idioma)) opciones.push(IDIOMAS.find((i) => i.id === puesto.idioma) || { id: puesto.idioma, nombre: puesto.idioma })
  abierta = { versiones, reglas, cardId: carta?.id || null, idiomas: opciones }
  const entrada = puesto ? puesto.idioma || '' : idiomaDeEntrada(market)
  const conVersion = versiones.length > 0
  d.querySelector('#iddTitulo').textContent = conVersion || puesto ? '¿Cómo la quieres?' : '¿En qué idioma la quieres?'
  d.querySelector('#iddCarta').textContent = nombre
  d.querySelector('#iddIdiomaRot').hidden = !conVersion
  d.querySelector('#iddIdiomaBloque').hidden = soloVersion
  d.querySelector('#iddVersionBloque').hidden = !conVersion
  const vPuesta = puesto?.variante && !versiones.some((v) => v.id === puesto.variante) ? [...versiones, { id: puesto.variante, nombre: puesto.variante }] : versiones
  abierta.versiones = vPuesta
  d.querySelector('#iddVersiones').innerHTML = conVersion
    ? [{ id: '', nombre: 'Cualquiera' }, ...vPuesta].map((v) => chipDeVersionHtml(v, v.id === (puesto?.variante || ''))).join('')
    : ''
  pintarIdiomas(entrada)
  d.querySelector('#iddNota').textContent = soloVersion
    ? 'La quieres en varios idiomas: aquí cambias la versión.'
    : conVersion
      ? '«Cualquiera» te cruza con más gente. Si quieres dos versiones, apúntala dos veces: son dos deseos.'
      : market === 'JP'
        ? (opciones.length > 1 ? 'Del catálogo japonés, en los idiomas en los que salió.' : 'Del catálogo japonés solo existe en japonés.')
        : '«Cualquiera» te cruza con más gente. Puedes apuntarla en dos idiomas: son dos deseos.'
  d.querySelector('#iddApuntar').textContent = puesto ? 'Guardar' : 'Apuntar'
  d.returnValue = ''
  return new Promise((resolver) => {
    d.addEventListener('close', () => {
      if (d.returnValue !== 'si') return resolver(undefined)
      const idioma = soloVersion ? puesto?.idioma ?? null : (idiomaMarcado() ?? entrada) || null
      resolver({ idioma, variante: conVersion ? versionMarcada() || null : puesto?.variante ?? null })
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
