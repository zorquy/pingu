// La pantalla de importar y exportar la colección (tanda 580). Entra por
// `import()` desde mi-coleccion.js al pulsar: casi nadie importa a diario
// y el lector de CSV no tiene por qué bajarse con la página.
//
// Lo puro —leer el CSV, reconocer columnas, emparejar— vive en
// importar-csv.js y se prueba en Node; aquí solo hay pantalla y base.
import { supabase } from '../supabase.js'
import { escapeHtml } from '../html.js'
import { showToast } from '../toast.js'
import * as datos from './datos.js'
import { nombreDeCarta } from '../catalogo-series.js'
import { leerCsv, reconocerColumnas, faltanColumnas, entradasDe, emparejar, exportarCsv, juntarLineas, deseosDeImportar, destinoDe } from './importar-csv.js'
import { APPS, pasosDe, perdidasHtml, csvDePerdidas } from './importar-apps.js'
import { consultaDeTcgdex, idDeTcgdex } from './cardmarket-wants.js'

const $ = (id) => document.getElementById(id)

// Los sets con su código de TCG Live: `setsDelMercado` de catalogo-buscar
// no lo trae, y es la llave que más fiable casa (Collectr y Dex lo usan).
async function setsConCodigo(mercado) {
  const { data, error } = await supabase
    .from('tcg_sets')
    .select('id,name,name_en,tcg_online_code')
    .eq('market', mercado)
    .limit(1000)
  if (error) throw error
  return data || []
}

// Los ataques y habilidades EN INGLÉS de unas cartas (1459): desempatan dos
// cartas de un set que se llaman igual cuando la fila no trae número (el
// nombre de Cardmarket los lleva entre corchetes). Lo guardado si la ficha
// está en inglés; si no, TCGdex en inglés, todas en UNA consulta GraphQL.
// Solo se pide para los empates, que son pocos.
async function ataquesEnIngles(ids, mercado) {
  const out = new Map()
  const nombres = (l) => (Array.isArray(l) ? l.map((x) => x?.name).filter(Boolean) : [])
  const { data } = await supabase.from('tcg_cards').select('id,attacks,abilities,detalle_lang').eq('market', mercado).in('id', ids)
  const preguntar = []
  for (const c of data || []) {
    if (c.detalle_lang === 'en' && nombres(c.attacks).length) out.set(c.id, [...nombres(c.abilities), ...nombres(c.attacks)])
    else if (idDeTcgdex(c.id)) preguntar.push(c.id)
  }
  if (preguntar.length) {
    try {
      const r = await fetch('https://api.tcgdex.net/v2/graphql', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: consultaDeTcgdex(preguntar.slice(0, 40)) }) })
      const j = r.ok ? await r.json() : null
      preguntar.slice(0, 40).forEach((id, k) => {
        const c = j?.data?.[`c${k}`]
        if (c) out.set(id, [...nombres(c.abilities), ...nombres(c.attacks)])
      })
    } catch {
      // Sin TCGdex no hay desempate: la fila sale en «no encontradas».
    }
  }
  return out
}

let emparejado = null // lo que se enseña en la vista previa
// Las cartas de un set (`cartasDeSet`) no traen el nombre del set: va aparte.
let nombreDeSet = new Map()

function pintarPaso(n) {
  for (const i of [1, 2]) $(`mcImpPaso${i}`)?.classList.toggle('hidden', i !== n)
}

async function leerFichero(fichero) {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader()
    lector.onload = () => resolver(String(lector.result || ''))
    lector.onerror = () => rechazar(new Error('No se ha podido leer el fichero.'))
    lector.readAsText(fichero)
  })
}

async function analizar({ mercado }) {
  const texto = $('mcImpTexto').value
  const estado = $('mcImpEstado')
  estado.textContent = 'Leyendo…'
  const filas = leerCsv(texto)
  if (filas.length < 2) {
    estado.textContent = 'No veo ninguna fila: pega el CSV con su cabecera y al menos una carta.'
    return
  }
  const { columnas, origen, sinUsar } = reconocerColumnas(filas[0])
  const faltan = faltanColumnas({ columnas })
  if (faltan.length) {
    estado.textContent = `En la cabecera no encuentro ${faltan.join(' ni ')}. Las columnas que veo: ${filas[0].join(', ')}.`
    return
  }
  const entradas = entradasDe(filas.slice(1), columnas, { idiomaSiFalta: $('mcImpIdioma').value, origen })
  estado.textContent = `Buscando ${entradas.length} cartas en el catálogo…`
  const sets = await setsConCodigo(mercado)
  nombreDeSet = new Map(sets.map((s) => [s.id, s.name || s.name_en]))
  emparejado = await emparejar(entradas, {
    sets,
    cartasDeSet: (setId) => datos.cartasDeSet(setId, mercado),
    cartaPorId: async (id) => (await datos.cartasPorIds([id], mercado)).get(id) || null,
    // El id de producto de Cardmarket (1459): el de su export y el de TheHobbyClub.
    cartasPorCardmarket: (ids) => datos.cartasPorCardmarket(ids, mercado),
    ataquesDe: (ids) => ataquesEnIngles(ids, mercado),
    mercado,
  })
  emparejado.origen = origen
  estado.textContent = ''
  pintarResumen({ columnas, origen, sinUsar })
  // Las listas de «La quiero» (1459): lo que te falta de cada colección de
  // TheHobbyClub puede ir a una lista con su nombre. Solo si la base las
  // tiene (migración 1057) y hay algo que falte.
  listasDeseo = null
  const faltanEnColecciones = origen === 'TheHobbyClub' && emparejado.listas.some((l) => l.destino === 'deseo' && l.entrada.coleccion)
  if (faltanEnColecciones && sesionAbierta) {
    try {
      listasDeseo = await import('./listas-deseo.js')
      if (!(await listasDeseo.cargarListas(sesionAbierta.user.id))) listasDeseo = null
    } catch {
      listasDeseo = null
    }
  }
  pintarCajaDeListas()
  pintarPaso(2)
}

let listasDeseo = null // el módulo de listas, si la base las tiene
let sesionAbierta = null

// El resumen y la lista de lo que se va a hacer. Se repinta al cambiar
// «Adónde van» sin volver a leer el fichero.
function pintarResumen({ columnas, origen, sinUsar }) {
  const { listas, perdidas } = emparejado
  const elegido = $('mcImpDestino')?.value || 'coleccion'
  const cuantas = { coleccion: 0, cambio: 0, deseo: 0 }
  for (const l of listas) cuantas[destinoDe(l, elegido)]++
  const copias = listas.filter((l) => destinoDe(l, elegido) !== 'deseo').reduce((n, l) => n + l.linea.cantidad, 0)
  const nombresRaros = listas.filter((l) => !l.nombreCasa).length
  const porNombre = listas.filter((l) => l.via === 'nombre').length
  const conSello = listas.filter((l) => l.entrada.sello && l.via !== 'cardmarket' && destinoDe(l, elegido) !== 'deseo').length
  const reparto = [
    cuantas.coleccion ? `<strong>${cuantas.coleccion}</strong> a tu colección (${copias} ${copias === 1 ? 'copia' : 'copias'})` : '',
    cuantas.cambio ? `<strong>${cuantas.cambio}</strong> a tu colección y para cambio, en «Las que doy» (${copias} ${copias === 1 ? 'copia' : 'copias'})` : '',
    cuantas.deseo ? `<strong>${cuantas.deseo}</strong> a «La quiero»` : '',
  ].filter(Boolean).join(' · ')
  $('mcImpResumen').innerHTML = `
    <p><strong>${listas.length}</strong> ${listas.length === 1 ? 'carta encontrada' : 'cartas encontradas'}${
      perdidas.length ? ` · <strong>${perdidas.length}</strong> sin encontrar` : ''
    }${origen ? ` · formato de ${escapeHtml(origen)}` : ''}</p>
    ${reparto ? `<p>${reparto}.</p>` : ''}
    ${origen === 'TheHobbyClub' && cuantas.deseo && elegido !== 'deseo' ? '<p class="subtext">Las que TheHobbyClub marca como que te faltan van a «La quiero», no a tu colección.</p>' : ''}
    ${columnas.idioma === undefined && listas.length ? `<p class="subtext">El fichero no dice el idioma: se guardan todas en ${escapeHtml($('mcImpIdioma').selectedOptions[0]?.textContent || '')}.</p>` : ''}
    ${nombresRaros ? `<p class="subtext">${nombresRaros} ${nombresRaros === 1 ? 'nombre no coincide' : 'nombres no coinciden'} con el de nuestro catálogo (suele ser el mismo en otro idioma): se importan igual por expansión y número.</p>` : ''}
    ${porNombre ? `<p class="subtext">${porNombre} sin número (lo que solo vende Cardmarket, sellos de liga…) ${porNombre === 1 ? 'se ha encontrado' : 'se han encontrado'} por su nombre: en su expansión no hay otra que se llame igual.</p>` : ''}
    ${conSello ? `<p class="subtext">${conSello} ${conSello === 1 ? 'es una versión' : 'son versiones'} que el catálogo no separa (un sello, lo que solo vende Cardmarket): ${conSello === 1 ? 'entra' : 'entran'} como la normal o la reverse y la versión queda en la nota de la copia.</p>` : ''}
    ${sinUsar.length ? `<p class="subtext">Columnas que no se usan: ${escapeHtml(sinUsar.join(', '))}.</p>` : ''}`
  // Lo que no casa (1329, G5): cada una con «Buscarla» y todas en un CSV.
  $('mcImpPerdidas').innerHTML = perdidasHtml(perdidas)
  const destinoCorto = { coleccion: '', cambio: ' · para cambio', deseo: ' · La quiero' }
  $('mcImpLista').innerHTML = listas.length
    ? `<p class="mc-imp-titulo">Lo que se va a hacer:</p><ul class="mc-imp-lista">${listas
        .slice(0, 60)
        .map((l) => `<li><span>${escapeHtml(nombreDeCarta(l.carta))} <small>${escapeHtml(l.carta.tcg_sets?.name || nombreDeSet.get(l.carta.set_id) || l.carta.set_id)} · ${escapeHtml(l.carta.local_id || '')}</small></span> <span class="subtext">${destinoDe(l, elegido) === 'deseo' ? '' : `×${l.linea.cantidad} · `}${escapeHtml(l.linea.idioma)}${destinoDe(l, elegido) === 'deseo' ? '' : ` · ${escapeHtml(l.linea.estado)}`}${l.linea.variante !== 'normal' ? ` · ${escapeHtml(l.linea.variante)}` : ''}${l.linea.gradeo ? ` · ${escapeHtml(l.linea.gradeo)}` : ''}${destinoCorto[destinoDe(l, elegido)]}</span></li>`)
        .join('')}${listas.length > 60 ? `<li class="subtext">…y ${listas.length - 60} más</li>` : ''}</ul>`
    : ''
  const boton = $('mcImpConfirmar')
  boton.disabled = !listas.length
  boton.textContent = !listas.length
    ? 'Nada que añadir'
    : cuantas.deseo && !cuantas.coleccion && !cuantas.cambio
      ? `Apuntar ${cuantas.deseo} en «La quiero»`
      : cuantas.deseo
        ? `Importar ${listas.length} ${listas.length === 1 ? 'carta' : 'cartas'}`
        : `Añadir ${listas.length} ${listas.length === 1 ? 'carta' : 'cartas'} a mi colección`
}

// La casilla de las listas (1459), con cuántas colecciones son.
function pintarCajaDeListas() {
  const caja = $('mcImpListas')
  if (!caja) return
  const elegido = $('mcImpDestino')?.value || 'coleccion'
  const nombres = new Set((emparejado?.listas || []).filter((l) => destinoDe(l, elegido) === 'deseo' && l.entrada.coleccion).map((l) => l.entrada.coleccion))
  const hay = Boolean(listasDeseo) && nombres.size > 0
  caja.hidden = !hay
  if (!hay) return
  caja.innerHTML = `<label class="mc-imp-check"><input type="checkbox" id="mcImpListasSi" checked /> Y guarda lo que te falta en listas de «La quiero», una por cada colección de TheHobbyClub (${nombres.size})</label>`
}

async function confirmar({ sesion, mercado, alTerminar }) {
  if (!emparejado?.listas.length) return
  const boton = $('mcImpConfirmar')
  boton.disabled = true
  boton.textContent = 'Guardando…'
  try {
    const elegido = $('mcImpDestino')?.value || 'coleccion'
    const aLaColeccion = emparejado.listas.filter((l) => destinoDe(l, elegido) !== 'deseo')
    const aLaQuiero = emparejado.listas.filter((l) => destinoDe(l, elegido) === 'deseo')
    // La misma copia en dos filas, una línea (1459); «para cambio» es darlas todas.
    const lineas = juntarLineas(aLaColeccion.map((l) => l.linea)).map((l) => (elegido === 'cambio' ? { ...l, cambio: l.cantidad } : l))
    // En tandas de 200: una sola sentencia con dos mil filas es un cuerpo
    // enorme y, si una falla, fallan todas.
    let puestas = 0
    let tachados = 0
    for (let i = 0; i < lineas.length; i += 200) {
      const trozo = lineas.slice(i, i + 200)
      const hechas = await datos.anadirVarias(sesion.user.id, trozo, mercado)
      puestas += hechas.length
      tachados += new Set(datos.deseosTachadosPor(hechas).map((f) => f.card_id)).size
      boton.textContent = `Guardando… ${Math.min(i + 200, lineas.length)} de ${lineas.length}`
    }
    // Lo que te falta, a «La quiero» (1459), y si se pidió, en su lista.
    let deseos = 0
    let enListas = 0
    if (aLaQuiero.length) {
      boton.textContent = 'Apuntando lo que te falta…'
      const cambios = await import('./cambios.js')
      deseos = (await cambios.anadirDeseos(sesion.user.id, deseosDeImportar(aLaQuiero))).length
      if (listasDeseo && $('mcImpListasSi')?.checked) enListas = await meterEnListas(aLaQuiero)
    }
    // Lo importado que tenías en «La quiero» sale de la lista (1063).
    const partes = [
      puestas ? `${puestas} ${puestas === 1 ? 'carta importada' : 'cartas importadas'}` : '',
      tachados ? `${tachados === 1 ? 'una sale' : `${tachados} salen`} de «La quiero»` : '',
      deseos ? `${deseos} ${deseos === 1 ? 'nueva' : 'nuevas'} en «La quiero»${enListas ? ` (en ${enListas} ${enListas === 1 ? 'lista' : 'listas'})` : ''}` : '',
    ].filter(Boolean)
    showToast(`${partes.join(' · ') || 'Nada nuevo: ya lo tenías todo apuntado'}.`, 'success')
    $('mcImportarDialogo').close()
    await alTerminar?.({ deseos })
  } catch (err) {
    showToast(err.message, 'error')
    boton.disabled = false
    boton.textContent = 'Volver a intentarlo'
  }
}

// Una lista de «La quiero» por colección de TheHobbyClub, con su nombre; si
// ya hay una que se llama igual, se usa esa. Devuelve en cuántas listas.
async function meterEnListas(items) {
  const porColeccion = new Map()
  for (const l of items) {
    const n = (l.entrada.coleccion || '').trim().slice(0, 60)
    if (!n) continue
    if (!porColeccion.has(n)) porColeccion.set(n, new Map())
    porColeccion.get(n).set(`${l.linea.card_id}|${l.linea.market}`, { card_id: l.linea.card_id, market: l.linea.market })
  }
  const pleg = (t) => String(t || '').trim().toLowerCase()
  let i = 0
  let hechas = 0
  for (const [nombre, cartas] of porColeccion) {
    const ya = listasDeseo.lasListas().find((x) => pleg(x.nombre) === pleg(nombre))
    const lista = ya || (await listasDeseo.crearLista({ nombre, color: listasDeseo.COLORES_LISTA[i++ % listasDeseo.COLORES_LISTA.length] }))
    await listasDeseo.meterEnLista(lista.id, [...cartas.values()])
    hechas++
  }
  return hechas
}

let enganchado = false

// De dónde viene (1329, G5): elegir la app no cambia cómo se lee el fichero
// (`reconocerColumnas` lo adivina solo); dice cómo sacarlo de allí y qué se lee.
function montarApps() {
  const paso = $('mcImpPaso1')
  if (!paso || $('mcImpApps')) return
  const caja = document.createElement('div')
  caja.id = 'mcImpApps'
  caja.className = 'mc-imp-apps'
  caja.innerHTML = `<p class="mc-imp-titulo">¿De dónde la traes?</p>
    <div class="mc-imp-apps-fila" role="group" aria-label="De qué app">${APPS.map((a) => `<button type="button" class="chip-filtro" data-imp-app="${a.id}" aria-pressed="false">${escapeHtml(a.nombre)}</button>`).join('')}</div>
    <p class="mc-nota" id="mcImpPasos" hidden></p>`
  paso.prepend(caja)
  caja.addEventListener('click', (e) => {
    const b = e.target.closest('[data-imp-app]')
    if (!b) return
    for (const x of caja.querySelectorAll('[data-imp-app]')) {
      x.setAttribute('aria-pressed', String(x === b))
      x.classList.toggle('active', x === b)
    }
    const p = $('mcImpPasos')
    p.textContent = pasosDe(b.dataset.impApp)
    p.hidden = false
  })
}

// Abre la bandeja de importar. `alTerminar` recarga la colección.
export function abrirImportar({ sesion, mercado = 'WEST', alTerminar } = {}) {
  const d = $('mcImportarDialogo')
  if (!d) return
  emparejado = null
  sesionAbierta = sesion || null
  montarApps()
  $('mcImpTexto').value = ''
  $('mcImpEstado').textContent = ''
  pintarPaso(1)
  if (!enganchado) {
    enganchado = true
    $('mcImpFichero')?.addEventListener('change', async (e) => {
      const f = e.target.files?.[0]
      if (!f) return
      try {
        $('mcImpTexto').value = await leerFichero(f)
        $('mcImpEstado').textContent = `Leído ${f.name}. Pulsa «Comprobar».`
      } catch (err) {
        showToast(err.message, 'error')
      }
    })
    $('mcImpAnalizar')?.addEventListener('click', () => analizar({ mercado }).catch((err) => { $('mcImpEstado').textContent = err.message }))
    $('mcImpVolver')?.addEventListener('click', () => pintarPaso(1))
    // Cambiar «Adónde van» con el resumen delante lo repinta sin releer.
    $('mcImpDestino')?.addEventListener('change', () => {
      if (!emparejado) return
      const filas = leerCsv($('mcImpTexto').value)
      if (filas.length) pintarResumen(reconocerColumnas(filas[0]))
      pintarCajaDeListas()
    })
    $('mcImpConfirmar')?.addEventListener('click', () => confirmar({ sesion, mercado, alTerminar }))
    $('mcImportarCerrar')?.addEventListener('click', () => d.close())
    $('mcImpPerdidas')?.addEventListener('click', (e) => {
      if (!e.target.closest('[data-imp-descargar-perdidas]') || !emparejado?.perdidas?.length) return
      descargarCsv(csvDePerdidas(emparejado.perdidas), 'cartas-sin-encontrar.csv')
    })
  }
  d.showModal()
}

// Descarga la colección entera como CSV, con el id de cada carta para
// que se pueda volver a importar aquí tal cual.
export function descargarExport({ lineas, cartaDe, nombreFichero = 'mi-coleccion-pokedoc.csv' }) {
  return descargarCsv(exportarCsv(lineas, cartaDe), nombreFichero)
}

function descargarCsv(csv, nombreFichero) {
  // El BOM es para Excel: sin él abre las tildes como basura.
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombreFichero
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return csv
}
