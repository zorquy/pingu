// /admin → Avisos (tanda 1120). Antes, en el Dashboard, el aviso global
// era un texto y un botón de guardar: no tenía tipo, no se apagaba solo y
// no se veía cómo quedaba. Ahora: tipo, enlace, desde y hasta, a quién, la
// vista previa (la MISMA franja que pinta la web, js/aviso-puro.js) y
// «mandarlo también a la campanita» (admin_aviso_campanita, migración 1120).
//
// Sigue guardándose en site_settings, clave `aviso_global`, como JSON: lo
// nuevo son campos y no pide migración. La campanita sí.
import { supabase } from '../../js/supabase.js'
import { escapeHtml } from '../../js/app.js'
import { showToast } from '../../js/toast.js'
import { TIPOS_DE_AVISO, PUBLICOS_DE_AVISO, tipoDeAviso, enlaceDeAviso, estadoDeAviso, franjaHtml } from '../../js/aviso-puro.js'

let actual = {}

// datetime-local habla en hora LOCAL y sin zona; la base guarda ISO.
export const aLocal = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d)) return ''
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
const aIso = (local) => (local ? new Date(local).toISOString() : null)
const fechaBonita = (iso) => new Date(iso).toLocaleString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })

// Lo que dice la línea de estado, en palabras.
export function fraseDeEstado(a, ahora = new Date()) {
  const e = estadoDeAviso(a, ahora)
  const hasta = a.hasta ? `, hasta el ${fechaBonita(a.hasta)}` : ''
  if (e === 'vacio') return { e, texto: 'No hay aviso.' }
  if (e === 'apagado') return { e, texto: 'Apagado: no sale en ninguna parte.' }
  if (e === 'programado') return { e, texto: `Programado: sale el ${fechaBonita(a.desde)}${hasta}.` }
  if (e === 'caducado') return { e, texto: `Se apagó solo el ${fechaBonita(a.hasta)}.` }
  return { e, texto: `Se ve ahora${a.publico && a.publico !== 'todos' ? ` (${PUBLICOS_DE_AVISO[a.publico].toLowerCase()})` : ''}${hasta}.` }
}

const chips = (nombre, opciones, puesto) => `<div class="av-chips" role="radiogroup">${Object.entries(opciones).map(([k, v]) => `<button type="button" role="radio" class="av-chip${k === puesto ? ' on' : ''}" aria-checked="${k === puesto}" data-av-${nombre}="${k}">${escapeHtml(typeof v === 'string' ? v : v.nombre)}</button>`).join('')}</div>`

function leer(caja) {
  const v = (id) => caja.querySelector(id).value.trim()
  return {
    texto: v('#avTexto'),
    tipo: caja.querySelector('[data-av-tipo].on')?.dataset.avTipo || 'novedad',
    enlace: v('#avEnlace'),
    texto_enlace: v('#avTextoEnlace'),
    desde: aIso(v('#avDesde')),
    hasta: aIso(v('#avHasta')),
    publico: caja.querySelector('[data-av-publico].on')?.dataset.avPublico || 'todos',
    activo: caja.querySelector('#avActivo').checked,
  }
}

function pintarPrevia(caja) {
  const a = leer(caja)
  const previa = { ...a, texto: a.texto || 'El texto del aviso' }
  caja.querySelector('#avPreviaPc').innerHTML = franjaHtml(previa)
  caja.querySelector('#avPreviaMovil').innerHTML = franjaHtml(previa)
  const { e, texto } = fraseDeEstado(a)
  const estado = caja.querySelector('#avEstado')
  estado.textContent = texto
  estado.dataset.estado = e
  const malEnlace = a.enlace && !enlaceDeAviso(a)
  caja.querySelector('#avEnlaceNota').hidden = !malEnlace
  const malFechas = a.desde && a.hasta && new Date(a.hasta) <= new Date(a.desde)
  caja.querySelector('#avFechasNota').hidden = !malFechas
  caja.querySelector('#avTextoEnlace').disabled = !a.enlace
}

async function ultimoEnviado() {
  const { data, error } = await supabase.from('avisos_enviados').select('titulo, personas, created_at').order('created_at', { ascending: false }).limit(1)
  if (error) return null
  return data?.[0] || false
}

export async function montarAvisos(caja) {
  if (!caja) return
  const { data } = await supabase.from('site_settings').select('value').eq('key', 'aviso_global').maybeSingle()
  actual = data?.value || {}
  const a = { ...actual, tipo: tipoDeAviso(actual), publico: PUBLICOS_DE_AVISO[actual.publico] ? actual.publico : 'todos' }
  caja.innerHTML = `
    <form class="av-form" id="avForm">
      <div class="av-campos">
        <label class="av-campo"><span class="av-eti">Texto</span>
          <input type="text" id="avTexto" maxlength="200" placeholder="El sábado hay torneo en la tienda de Bilbao" value="${escapeHtml(a.texto || '')}" /></label>
        <div class="av-campo"><span class="av-eti">Tipo</span>${chips('tipo', TIPOS_DE_AVISO, a.tipo)}</div>
        <div class="av-dos">
          <label class="av-campo"><span class="av-eti">Enlace (opcional)</span>
            <input type="text" id="avEnlace" placeholder="/torneos o https://…" value="${escapeHtml(a.enlace || '')}" />
            <small class="av-nota av-mal" id="avEnlaceNota" hidden>Empieza por / (de PokeDoc) o por https://, o no saldrá.</small></label>
          <label class="av-campo"><span class="av-eti">Texto del enlace</span>
            <input type="text" id="avTextoEnlace" maxlength="30" placeholder="Ver más" value="${escapeHtml(a.texto_enlace || '')}" /></label>
        </div>
        <div class="av-dos">
          <label class="av-campo"><span class="av-eti">Desde (opcional)</span><input type="datetime-local" id="avDesde" value="${aLocal(a.desde)}" /></label>
          <label class="av-campo"><span class="av-eti">Hasta (opcional)</span><input type="datetime-local" id="avHasta" value="${aLocal(a.hasta)}" /></label>
        </div>
        <small class="av-nota av-mal" id="avFechasNota" hidden>«Hasta» va después de «Desde».</small>
        <div class="av-campo"><span class="av-eti">A quién</span>${chips('publico', PUBLICOS_DE_AVISO, a.publico)}</div>
        <label class="av-interruptor"><input type="checkbox" id="avActivo" ${a.activo ? 'checked' : ''} /> <span>Activo</span></label>
        <label class="av-interruptor"><input type="checkbox" id="avCampanita" /> <span>Mandarlo también a la campanita</span></label>
        <small class="av-nota" id="avCampanitaNota">Llega a todas las cuentas (menos a quien apagó «Novedades y avisos del equipo» en Ajustes), también a quien no entre estos días. Se manda al guardar.</small>
      </div>
      <div class="av-previa">
        <span class="av-eti">Así se ve</span>
        <p class="av-estado" id="avEstado"></p>
        <div class="av-marco av-marco-pc" id="avPreviaPc"></div>
        <div class="av-marco av-marco-movil" id="avPreviaMovil"></div>
        <p class="av-nota" id="avUltimo"></p>
      </div>
      <div class="av-acciones">
        <button type="submit" class="btn-primary" id="avGuardar">Guardar</button>
        ${a.texto ? '<button type="button" class="btn-secondary" id="avQuitar">Quitar el aviso</button>' : ''}
      </div>
    </form>`

  pintarPrevia(caja)
  ultimoEnviado().then((u) => {
    const p = caja.querySelector('#avUltimo')
    if (u === null) p.textContent = 'La campanita necesita supabase-migration-1120-avisos.sql.'
    else if (u) p.textContent = `Último a la campanita: «${u.titulo}», el ${fechaBonita(u.created_at)}, a ${u.personas} ${u.personas === 1 ? 'persona' : 'personas'}.`
  })

  caja.addEventListener('input', () => pintarPrevia(caja))
  caja.addEventListener('change', () => pintarPrevia(caja))
  caja.addEventListener('click', (e) => {
    const chip = e.target.closest('.av-chip')
    if (chip) {
      for (const c of chip.parentElement.children) {
        c.classList.toggle('on', c === chip)
        c.setAttribute('aria-checked', String(c === chip))
      }
      pintarPrevia(caja)
    }
    // Las cerrar de la vista previa no cierran nada.
    if (e.target.closest('.av-marco .aviso-global-cerrar, .av-marco a')) e.preventDefault()
  })

  caja.querySelector('#avQuitar')?.addEventListener('click', async () => {
    const { error } = await guardar({})
    if (error) return
    showToast('Aviso quitado.', 'success')
    montarAvisos(caja)
  })

  caja.querySelector('#avForm').addEventListener('submit', async (e) => {
    e.preventDefault()
    const nuevo = leer(caja)
    if (!nuevo.texto && nuevo.activo) return showToast('El aviso necesita un texto.', 'error')
    if (nuevo.enlace && !enlaceDeAviso(nuevo)) return showToast('El enlace tiene que empezar por / o por https://.', 'error')
    if (nuevo.desde && nuevo.hasta && new Date(nuevo.hasta) <= new Date(nuevo.desde)) return showToast('«Hasta» va después de «Desde».', 'error')
    const boton = caja.querySelector('#avGuardar')
    boton.disabled = true
    try {
      const { error } = await guardar(nuevo)
      if (error) return
      actual = nuevo
      const campanita = caja.querySelector('#avCampanita')
      if (campanita.checked && nuevo.texto) {
        const { data: r, error: errC } = await supabase.rpc('admin_aviso_campanita', { p_titulo: nuevo.texto, p_cuerpo: null, p_enlace: enlaceDeAviso(nuevo) || null })
        if (errC) {
          const falta = /PGRST202|Could not find the function/i.test(`${errC.code} ${errC.message}`)
          showToast(falta ? 'Guardado, pero la campanita necesita supabase-migration-1120-avisos.sql.' : `Guardado, pero la campanita no: ${errC.message}`, 'error')
          return
        }
        campanita.checked = false
        showToast(r?.ya ? 'Guardado. Ese aviso ya se mandó a la campanita hace menos de una hora.' : `Guardado y mandado a ${r?.personas ?? 0} personas.`, 'success')
        const u = await ultimoEnviado()
        if (u) caja.querySelector('#avUltimo').textContent = `Último a la campanita: «${u.titulo}», el ${fechaBonita(u.created_at)}, a ${u.personas} ${u.personas === 1 ? 'persona' : 'personas'}.`
        return
      }
      showToast(fraseDeEstado(nuevo).e === 'activo' ? 'Guardado. El aviso ya está en la web.' : `Guardado. ${fraseDeEstado(nuevo).texto}`, 'success')
    } finally {
      boton.disabled = false
    }
  })
}

async function guardar(valor) {
  const { error } = await supabase.from('site_settings').upsert({ key: 'aviso_global', value: valor, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (!error) document.dispatchEvent(new CustomEvent('pd-aviso-guardado'))
  if (error) {
    const faltaTabla = /site_settings/.test(error.message || '')
    showToast(faltaTabla ? 'Falta ejecutar supabase-migration-ajustes.sql en el SQL Editor de Supabase.' : 'No se ha podido guardar: ' + error.message, 'error')
  }
  return { error }
}

// La línea de «Hoy»: si hay aviso y cómo está.
export async function estadoParaHoy() {
  const { data } = await supabase.from('site_settings').select('value').eq('key', 'aviso_global').maybeSingle()
  const a = data?.value || {}
  const { e } = fraseDeEstado(a)
  if (e === 'vacio') return null
  const etiqueta = { activo: 'Aviso en la web', programado: 'Aviso programado', caducado: 'Aviso caducado', apagado: 'Aviso apagado' }[e]
  return { e, texto: `${etiqueta}: «${String(a.texto).trim().slice(0, 60)}»` }
}
