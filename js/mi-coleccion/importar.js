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
import { leerCsv, reconocerColumnas, faltanColumnas, entradasDe, emparejar, exportarCsv } from './importar-csv.js'

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

let emparejado = null // lo que se enseña en la vista previa

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
  const entradas = entradasDe(filas.slice(1), columnas, { idiomaSiFalta: $('mcImpIdioma').value })
  estado.textContent = `Buscando ${entradas.length} cartas en el catálogo…`
  const sets = await setsConCodigo(mercado)
  emparejado = await emparejar(entradas, {
    sets,
    cartasDeSet: (setId) => datos.cartasDeSet(setId, mercado),
    cartaPorId: async (id) => (await datos.cartasPorIds([id], mercado)).get(id) || null,
    mercado,
  })
  estado.textContent = ''
  const { listas, perdidas } = emparejado
  const copias = listas.reduce((n, l) => n + l.linea.cantidad, 0)
  const nombresRaros = listas.filter((l) => !l.nombreCasa).length
  $('mcImpResumen').innerHTML = `
    <p><strong>${listas.length}</strong> ${listas.length === 1 ? 'carta encontrada' : 'cartas encontradas'} (${copias} ${copias === 1 ? 'copia' : 'copias'})${
      perdidas.length ? ` · <strong>${perdidas.length}</strong> sin encontrar` : ''
    }${origen ? ` · formato de ${escapeHtml(origen)}` : ''}</p>
    ${columnas.idioma === undefined && listas.length ? `<p class="subtext">El fichero no dice el idioma: se guardan todas en ${escapeHtml($('mcImpIdioma').selectedOptions[0]?.textContent || '')}.</p>` : ''}
    ${nombresRaros ? `<p class="subtext">${nombresRaros} ${nombresRaros === 1 ? 'nombre no coincide' : 'nombres no coinciden'} con el de nuestro catálogo (suele ser el mismo en otro idioma): se importan igual por expansión y número.</p>` : ''}
    ${sinUsar.length ? `<p class="subtext">Columnas que no se usan: ${escapeHtml(sinUsar.join(', '))}.</p>` : ''}`
  $('mcImpPerdidas').innerHTML = perdidas.length
    ? `<p class="mc-imp-titulo">Sin encontrar (no se importan):</p><ul class="mc-imp-lista">${perdidas
        .slice(0, 60)
        .map((p) => `<li><span>Línea ${p.entrada.fila}${p.entrada.nombre ? ` · ${escapeHtml(p.entrada.nombre)}` : ''}</span> <span class="subtext">${escapeHtml(p.motivo)}</span></li>`)
        .join('')}${perdidas.length > 60 ? `<li class="subtext">…y ${perdidas.length - 60} más</li>` : ''}</ul>`
    : ''
  $('mcImpLista').innerHTML = listas.length
    ? `<p class="mc-imp-titulo">Se van a añadir:</p><ul class="mc-imp-lista">${listas
        .slice(0, 60)
        .map((l) => `<li><span>${escapeHtml(l.carta.name_es || l.carta.name)} <small>${escapeHtml(l.carta.tcg_sets?.name || l.carta.set_id)} · ${escapeHtml(l.carta.local_id || '')}</small></span> <span class="subtext">×${l.linea.cantidad} · ${escapeHtml(l.linea.idioma)} · ${escapeHtml(l.linea.estado)}${l.linea.variante !== 'normal' ? ` · ${escapeHtml(l.linea.variante)}` : ''}${l.linea.gradeo ? ` · ${escapeHtml(l.linea.gradeo)}` : ''}</span></li>`)
        .join('')}${listas.length > 60 ? `<li class="subtext">…y ${listas.length - 60} más</li>` : ''}</ul>`
    : ''
  const boton = $('mcImpConfirmar')
  boton.disabled = !listas.length
  boton.textContent = listas.length ? `Añadir ${listas.length} ${listas.length === 1 ? 'carta' : 'cartas'} a mi colección` : 'Nada que añadir'
  pintarPaso(2)
}

async function confirmar({ sesion, mercado, alTerminar }) {
  if (!emparejado?.listas.length) return
  const boton = $('mcImpConfirmar')
  boton.disabled = true
  boton.textContent = 'Guardando…'
  try {
    // En tandas de 200: una sola sentencia con dos mil filas es un cuerpo
    // enorme y, si una falla, fallan todas.
    const lineas = emparejado.listas.map((l) => l.linea)
    let puestas = 0
    for (let i = 0; i < lineas.length; i += 200) {
      const trozo = lineas.slice(i, i + 200)
      puestas += (await datos.anadirVarias(sesion.user.id, trozo, mercado)).length
      boton.textContent = `Guardando… ${Math.min(i + 200, lineas.length)} de ${lineas.length}`
    }
    showToast(`${puestas} ${puestas === 1 ? 'carta importada' : 'cartas importadas'}.`, 'success')
    $('mcImportarDialogo').close()
    await alTerminar?.()
  } catch (err) {
    showToast(err.message, 'error')
    boton.disabled = false
    boton.textContent = 'Volver a intentarlo'
  }
}

let enganchado = false

// Abre la bandeja de importar. `alTerminar` recarga la colección.
export function abrirImportar({ sesion, mercado = 'WEST', alTerminar } = {}) {
  const d = $('mcImportarDialogo')
  if (!d) return
  emparejado = null
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
    $('mcImpConfirmar')?.addEventListener('click', () => confirmar({ sesion, mercado, alTerminar }))
    $('mcImportarCerrar')?.addEventListener('click', () => d.close())
  }
  d.showModal()
}

// Descarga la colección entera como CSV, con el id de cada carta para
// que se pueda volver a importar aquí tal cual.
export function descargarExport({ lineas, cartaDe, nombreFichero = 'mi-coleccion-pokedoc.csv' }) {
  const csv = exportarCsv(lineas, cartaDe)
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
