// Importar el stock de una tienda desde un CSV (tanda 1068): su Excel,
// el de Cardmarket o lo que exportó de aquí. El mismo importador que Mi
// colección (`importar-csv.js`: reconocer columnas, traducir celdas y
// encontrar cada carta por su id, o por su expansión y su número), con tres
// columnas más: a cuánto lo vende, dónde está y si se enseña.
//
// Lo sellado no se importa todavía: un producto no tiene expansión y número
// con los que encontrarlo. Se dice en la vista previa, con las demás que no
// se encuentran.
import { supabase } from './supabase.js'
import { escapeHtml } from './html.js'
import { showToast } from './toast.js'
import { leerCsv, reconocerColumnas, faltanColumnas, entradasDe, emparejar } from './mi-coleccion/importar-csv.js'
import { extrasDeFila, filasDeStock } from './tienda-csv.js'
import { cartasDeSet, cartasPorIds } from './mi-coleccion/datos.js'

const TANDA = 500

async function setsDe(mercado) {
  const { data, error } = await supabase.from('tcg_sets').select('id,name,name_en,tcg_online_code').eq('market', mercado).limit(1000)
  if (error) throw error
  return data || []
}

export function abrirImportarStock({ perfil, alTerminar = () => {} }) {
  let d = document.getElementById('tdsImportar')
  if (!d) {
    d = document.createElement('dialog')
    d.id = 'tdsImportar'
    d.className = 'tds-dialogo tds-importar'
    document.body.append(d)
    d.addEventListener('click', (e) => { if (e.target === d || e.target.closest('[data-cerrar]')) d.close() })
  }
  d.innerHTML = `
    <div class="tds-dialogo-cuerpo">
      <div class="tds-dialogo-cab"><h2>Importar tu stock</h2><button type="button" class="tds-cerrar" data-cerrar aria-label="Cerrar">×</button></div>
      <p class="tds-nota">Un CSV con una fila por carta: la expansión (nombre o código) y el número, o el id de PokeDoc. Se leen también las unidades, el estado, el idioma, la versión, lo que pagaste, tu precio (PVP) y dónde está. Desde Excel, guárdalo como CSV.</p>
      <div class="tds-form-fila">
        <label>El fichero<input type="file" accept=".csv,text/csv,text/plain" data-fichero /></label>
        <label>Catálogo<select data-mercado><option value="WEST">Pokémon</option><option value="JP">Japón</option></select></label>
        <label>Si no dice el idioma<select data-idioma><option value="es">Español</option><option value="en">Inglés</option><option value="fr">Francés</option><option value="de">Alemán</option><option value="it">Italiano</option><option value="pt">Portugués</option><option value="ja">Japonés</option></select></label>
      </div>
      <details><summary>O pégalo aquí</summary><textarea rows="5" data-texto placeholder="expansion;numero;unidades;coste;pvp"></textarea></details>
      <p class="tds-nota" data-estado aria-live="polite"></p>
      <div data-resumen></div>
      <div class="tds-form-pie"><button type="button" class="btn-secondary" data-cerrar>Cancelar</button><button type="button" class="btn-secondary" data-leer>Leer</button><button type="button" class="btn-primary" data-meter disabled>Meter en el stock</button></div>
    </div>`
  let listo = null
  const estado = d.querySelector('[data-estado]')
  const leer = async () => {
    const fichero = d.querySelector('[data-fichero]').files?.[0]
    const texto = fichero ? await fichero.text() : d.querySelector('[data-texto]').value
    const mercado = d.querySelector('[data-mercado]').value
    listo = null
    d.querySelector('[data-meter]').disabled = true
    d.querySelector('[data-resumen]').innerHTML = ''
    const filas = leerCsv(texto)
    if (filas.length < 2) return (estado.textContent = 'No veo ninguna fila: hace falta la cabecera y al menos una carta.')
    const { columnas, sinUsar } = reconocerColumnas(filas[0])
    const faltan = faltanColumnas({ columnas })
    if (faltan.length) return (estado.textContent = `En la cabecera no encuentro ${faltan.join(' ni ')}. Las columnas que veo: ${filas[0].join(', ')}.`)
    const datos = filas.slice(1)
    const entradas = entradasDe(datos, columnas, { idiomaSiFalta: d.querySelector('[data-idioma]').value })
    estado.textContent = `Buscando ${entradas.length} cartas en el catálogo…`
    try {
      const { listas, perdidas } = await emparejar(entradas, {
        sets: await setsDe(mercado),
        cartasDeSet: (setId) => cartasDeSet(setId, mercado),
        cartaPorId: async (id) => (await cartasPorIds([id], mercado)).get(id) || null,
        mercado,
      })
      listo = filasDeStock(listas, extrasDeFila(datos, columnas), perfil.id)
      const unidades = listo.reduce((n, f) => n + f.unidades, 0)
      estado.textContent = ''
      const ojo = [
        columnas.precioCompra === undefined ? 'no hay columna de lo que pagaste' : null,
        columnas.precioVenta === undefined ? 'no hay columna de tu precio (PVP)' : null,
      ].filter(Boolean)
      d.querySelector('[data-resumen]').innerHTML = `
        <p><strong>${listo.length}</strong> ${listo.length === 1 ? 'carta encontrada' : 'cartas encontradas'} (${unidades} unidades)${perdidas.length ? ` · <strong>${perdidas.length}</strong> sin encontrar` : ''}</p>
        ${ojo.length ? `<p class="tds-nota">Ojo: ${ojo.join(' y ')}; esas se quedan vacías y las pones luego.</p>` : ''}
        ${sinUsar.length ? `<p class="tds-nota">Columnas que no uso: ${escapeHtml(sinUsar.join(', '))}.</p>` : ''}
        ${perdidas.length ? `<details><summary>Las que no encuentro</summary><ul class="tds-perdidas">${perdidas.slice(0, 50).map((p) => `<li>Línea ${p.entrada.fila}: ${escapeHtml(p.entrada.nombre || '')} — ${escapeHtml(p.motivo)}</li>`).join('')}${perdidas.length > 50 ? `<li>…y ${perdidas.length - 50} más</li>` : ''}</ul></details>` : ''}`
      const meter = d.querySelector('[data-meter]')
      meter.disabled = !listo.length
      meter.textContent = `Meter ${listo.length} en el stock`
    } catch (e) {
      estado.textContent = `No se ha podido buscar: ${e?.message || 'sin motivo'}.`
    }
  }
  d.querySelector('[data-leer]').addEventListener('click', leer)
  d.querySelector('[data-fichero]').addEventListener('change', leer)
  d.querySelector('[data-meter]').addEventListener('click', async (e) => {
    if (!listo?.length) return
    const boton = e.currentTarget
    boton.disabled = true
    let metidas = 0
    for (let i = 0; i < listo.length; i += TANDA) {
      estado.textContent = `Metiendo ${Math.min(i + TANDA, listo.length)} de ${listo.length}…`
      const { data, error } = await supabase.from('tienda_stock').insert(listo.slice(i, i + TANDA)).select('id')
      if (error || !data) {
        estado.textContent = `Se han metido ${metidas}; el resto ha fallado: ${error?.message || 'sin motivo'}. Puedes volver a importar solo lo que falta.`
        alTerminar()
        return
      }
      metidas += data.length
    }
    d.close()
    showToast(`${metidas} ${metidas === 1 ? 'línea metida' : 'líneas metidas'} en el stock.`, 'success')
    alTerminar()
  })
  d.showModal()
}
