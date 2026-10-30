// EL PANEL DE LOGROS (tanda 1118, PINGU eligió la propuesta «Panel de admin
// nuevo»). Antes era una tabla con «Condición ≥ número» y un formulario de
// diez campos en una ventana, cuyo desplegable de condiciones no tenía los
// tipos de los retos ni de invitar: abrir uno de esos y guardar le cambiaba
// la regla a «Cursos completados» sin avisar.
//
// Ahora: la rejilla de logros como los ve la gente (icono, rareza, «cómo se
// consigue» y cuánta gente lo tiene), filtros por familia y el editor en un
// cajón con la frase en vivo, la vista previa, «Duplicar», y la pestaña
// «Quién lo tiene» con dar y quitar a mano (migración 1118).
import { supabase } from '../../js/supabase.js'
import { escapeHtml, achievementIconHtml } from '../../js/app.js'
import { invalidateAchievementsCache } from '../../js/gamification.js'
import { showToast } from '../../js/toast.js'
import { icons } from '../../js/icons.js'
import { objetivoAutomatico, objetivoDeLogro, RAREZAS, FAMILIAS, TIPOS, familiaDeLogro, textoDeReparto } from '../../js/logro-objetivo.js'

// Los iconos que tiene sentido poner en un logro (de js/icons.js).
const ICONOS = ['trophy', 'medal', 'crown', 'star', 'flame', 'layers', 'cards', 'gem', 'coins', 'eye', 'compass', 'palette', 'refreshCw', 'messageSquare', 'heart', 'bookOpen', 'graduationCap', 'sparkles', 'zap', 'target', 'shield', 'users', 'calendar', 'flag', 'lightbulb', 'sprout', 'trendingUp', 'package'].filter((n) => icons[n])

let caja = null
let logros = []
let reparto = {}
let filtro = 'todos'
let busqueda = ''
let abierto = null // el logro del cajón (o un borrador nuevo)
let pestana = 'datos'
let hayObjetivo = true // la columna de la 1118

const vacio = () => ({ id: '', title: '', description: '', objetivo: '', emoji: 'trophy', icon_url: '', rarity: 'bronze', xp_reward: 25, is_active: true, condition: { type: 'completed_guides_count', count: 1 } })

export async function montarLogros(destino) {
  caja = destino
  caja.classList.add('lg-panel')
  await cargar()
}

async function cargar() {
  const [{ data, error }, rep] = await Promise.all([
    supabase.from('achievement_definitions').select('*').order('xp_reward'),
    supabase.rpc('logros_reparto').then((r) => r, () => ({ data: null })),
  ])
  if (error) {
    caja.innerHTML = `<p class="admin-note admin-note-alerta">No se han podido leer los logros: ${escapeHtml(error.message)}</p>`
    return
  }
  logros = data || []
  hayObjetivo = !logros.length || logros.some((l) => 'objetivo' in l)
  reparto = {}
  for (const f of rep?.data || []) reparto[f.id] = { personas: Number(f.personas) || 0, total: Number(f.total) || 0 }
  if (abierto?.id) abierto = logros.find((l) => l.id === abierto.id) || abierto
  pintar()
}

const personasDe = (id) => reparto[id]?.personas ?? null
const nadieLoTiene = (l) => reparto[l.id] && reparto[l.id].personas === 0

function cuentaDeFiltro(clave) {
  if (clave === 'todos') return logros.length
  if (clave === 'nadie') return logros.filter(nadieLoTiene).length
  if (clave === 'apagados') return logros.filter((l) => !l.is_active).length
  return logros.filter((l) => familiaDeLogro(l) === clave).length
}

function visibles() {
  const q = busqueda.trim().toLowerCase()
  return logros.filter((l) => {
    if (filtro === 'nadie' && !nadieLoTiene(l)) return false
    if (filtro === 'apagados' && l.is_active) return false
    if (filtro in FAMILIAS && familiaDeLogro(l) !== filtro) return false
    return !q || `${l.title} ${l.id} ${objetivoDeLogro(l) || ''}`.toLowerCase().includes(q)
  })
}

function tarjetaHtml(l) {
  const p = reparto[l.id]
  const pct = p?.total ? (p.personas / p.total) * 100 : null
  const pie = !l.is_active
    ? '<span class="lg-apagado">Apagado</span>'
    : p && p.personas === 0
      ? '<span class="lg-aviso">Nadie lo tiene</span>'
      : pct !== null
        ? `<span class="lg-barra"><i style="width:${Math.max(2, Math.min(100, pct)).toFixed(1)}%"></i></span><span>${pct < 1 ? '<1' : Math.round(pct)} % · ${p.personas.toLocaleString('es-ES')}</span>`
        : ''
  return `<button type="button" class="lg-tarjeta${l.is_active ? '' : ' apagado'}${abierto?.id === l.id ? ' sel' : ''}" data-lg="${escapeHtml(l.id)}">
    <span class="lg-ico r-${escapeHtml(l.rarity || 'bronze')}">${achievementIconHtml(l, 20)}</span>
    <span class="lg-txt"><b>${escapeHtml(l.title)}</b><span class="lg-obj">${escapeHtml(objetivoDeLogro(l) || l.description || '')}</span><span class="lg-pie">${pie}</span></span>
  </button>`
}

function pintar() {
  const chips = [['todos', 'Todos'], ...Object.entries(FAMILIAS), ['nadie', 'Nadie lo tiene'], ['apagados', 'Apagados']]
    .map(([k, t]) => [k, t, cuentaDeFiltro(k)])
    .filter(([k, , n]) => k === 'todos' || n > 0)
  const lista = visibles()
  caja.innerHTML = `
    <div class="lg-cuerpo${abierto ? ' con-cajon' : ''}">
      <div class="lg-main">
        <div class="lg-cab">
          <span class="lg-cuenta">${logros.length} · ${cuentaDeFiltro('apagados')} apagados</span>
          <span class="lg-esp"></span>
          <label class="lg-lupa">${icons.search(14)}<input type="search" id="lgBuscar" placeholder="Busca un logro" value="${escapeHtml(busqueda)}" aria-label="Buscar un logro" /></label>
          <button type="button" class="btn-primary lg-nuevo" data-lg-nuevo>+ Nuevo logro</button>
        </div>
        <div class="lg-chips" role="group" aria-label="Familias">${chips.map(([k, t, n]) => `<button type="button" class="lg-chip${filtro === k ? ' on' : ''}" data-lg-filtro="${k}" aria-pressed="${filtro === k}">${escapeHtml(t)}<em>${n}</em></button>`).join('')}</div>
        ${lista.length ? `<div class="lg-rejilla">${lista.map(tarjetaHtml).join('')}</div>` : '<p class="admin-note">Ningún logro con ese filtro.</p>'}
      </div>
      ${abierto ? `<aside class="lg-cajon" aria-label="Editar el logro">${cajonHtml()}</aside>` : ''}
    </div>`
  enganchar()
}

// ── El cajón ──

function cajonHtml() {
  const l = abierto
  const nuevo = !l.id || !logros.some((x) => x.id === l.id)
  const n = personasDe(l.id)
  return `
    <div class="lg-cajon-cab">
      <b>${nuevo ? 'Nuevo logro' : escapeHtml(l.title)}</b>
      <button type="button" class="lg-cerrar" data-lg-cerrar aria-label="Cerrar el editor">✕</button>
    </div>
    ${nuevo ? '' : `<div class="lg-pestanas" role="tablist">
      <button type="button" role="tab" class="${pestana === 'datos' ? 'on' : ''}" aria-selected="${pestana === 'datos'}" data-lg-pestana="datos">Datos</button>
      <button type="button" role="tab" class="${pestana === 'quien' ? 'on' : ''}" aria-selected="${pestana === 'quien'}" data-lg-pestana="quien">Quién lo tiene${n !== null ? ` · ${n.toLocaleString('es-ES')}` : ''}</button>
    </div>`}
    ${pestana === 'quien' && !nuevo ? '<div id="lgQuien" class="lg-quien"><p class="admin-note">Cargando…</p></div>' : datosHtml(l, nuevo)}`
}

function datosHtml(l, nuevo) {
  const tipo = l.condition?.type || 'manual'
  const conCuenta = !['manual', 'primeros_pasos', 'was_referred', 'carta_primera'].includes(tipo)
  const tipos = Object.entries(FAMILIAS).map(([f, t]) => {
    const deEsta = TIPOS.filter((x) => x.familia === f)
    return deEsta.length ? `<optgroup label="${escapeHtml(t)}">${deEsta.map((x) => `<option value="${x.tipo}" ${x.tipo === tipo ? 'selected' : ''}>${escapeHtml(x.etiqueta)}</option>`).join('')}</optgroup>` : ''
  }).join('')
  // Un tipo que la web no conoce se ofrece igual: si no, el desplegable se
  // quedaría con el primero y al guardar se cambiaría la regla (la 472).
  const desconocido = TIPOS.some((x) => x.tipo === tipo) ? '' : `<option value="${escapeHtml(tipo)}" selected>${escapeHtml(tipo)}</option>`
  const auto = objetivoAutomatico(l) || 'Sin frase automática para este tipo: escríbela abajo.'
  return `
    <form class="lg-form" id="lgForm" autocomplete="off">
      <div class="lg-campo"><label for="lgTitulo">Nombre</label><input id="lgTitulo" required value="${escapeHtml(l.title || '')}" placeholder="Cien cartas" /></div>
      ${nuevo ? `<div class="lg-campo"><label for="lgId">Clave (no se puede cambiar después)</label><input id="lgId" required pattern="[a-z0-9_]+" value="${escapeHtml(l.id || '')}" placeholder="coleccion_100" /></div>` : ''}
      <div class="lg-campo"><span class="lg-eti">Icono</span><div class="lg-iconos" role="radiogroup" aria-label="Icono">${ICONOS.map((nombre) => `<button type="button" role="radio" aria-checked="${l.emoji === nombre}" aria-label="${nombre}" class="${l.emoji === nombre ? 'on' : ''}" data-lg-icono="${nombre}">${icons[nombre](16)}</button>`).join('')}</div></div>
      <div class="lg-campo"><span class="lg-eti">Rareza</span><div class="lg-seg" role="radiogroup" aria-label="Rareza">${Object.entries(RAREZAS).map(([r, t]) => `<button type="button" role="radio" aria-checked="${(l.rarity || 'bronze') === r}" class="${(l.rarity || 'bronze') === r ? 'on' : ''}" data-lg-rareza="${r}"><i class="r-${r}"></i>${t}</button>`).join('')}</div></div>
      <div class="lg-campo"><label for="lgTipo">Cómo se consigue</label>
        <div class="lg-fila"><select id="lgTipo">${desconocido}${tipos}</select>${conCuenta ? `<input id="lgCuenta" type="number" inputmode="numeric" min="1" value="${Number(l.condition?.count ?? 1)}" aria-label="Cuántos" />` : ''}</div>
        <p class="lg-frase" id="lgFrase">«${escapeHtml(auto)}»</p>
      </div>
      ${hayObjetivo ? `<div class="lg-campo"><label for="lgObjetivo">Decirlo con tus palabras (opcional)</label><textarea id="lgObjetivo" rows="2" placeholder="Si lo dejas vacío, se usa la frase de arriba">${escapeHtml(l.objetivo || '')}</textarea></div>` : ''}
      <div class="lg-campo"><label for="lgDesc">Lo que hiciste (cuando ya lo tienes)</label><textarea id="lgDesc" rows="2" placeholder="Tienes 100 cartas distintas en tu colección.">${escapeHtml(l.description || '')}</textarea></div>
      <div class="lg-fila"><div class="lg-campo"><label for="lgXp">XP</label><input id="lgXp" type="number" inputmode="numeric" min="0" value="${Number(l.xp_reward ?? 0)}" /></div>
        <label class="lg-activo"><input type="checkbox" id="lgActivo" ${l.is_active ? 'checked' : ''} /> Activo</label></div>
      <details class="lg-mas"><summary>Icono propio (una imagen)</summary><div class="lg-campo"><label for="lgIconUrl">Dirección de la imagen</label><input id="lgIconUrl" value="${escapeHtml(l.icon_url || '')}" placeholder="https://…" /></div></details>
      <div class="lg-previa" id="lgPrevia">${previaHtml(l)}</div>
      <div class="lg-fila lg-acciones">
        <button type="submit" class="btn-primary">Guardar</button>
        ${nuevo ? '' : '<button type="button" class="btn-secondary" data-lg-duplicar>Duplicar</button>'}
        <span class="lg-esp"></span>
        ${nuevo ? '' : '<button type="button" class="btn-secondary lg-borrar" data-lg-borrar>Borrar</button>'}
      </div>
    </form>`
}

function previaHtml(l) {
  const p = reparto[l.id]
  const t = p ? textoDeReparto(p.personas, p.total) : ''
  return `<span class="lg-eti">Así lo ve la gente</span>
    <span class="lg-ico grande r-${escapeHtml(l.rarity || 'bronze')}">${achievementIconHtml(l, 26)}</span>
    <b>${escapeHtml(l.title || 'Sin nombre')}</b>
    <small>${RAREZAS[l.rarity || 'bronze']} · +${Number(l.xp_reward) || 0} XP${t ? ` · ${escapeHtml(t.toLowerCase())}` : ''}</small>
    <small class="lg-previa-obj">${escapeHtml(objetivoDeLogro(l) || '')}</small>`
}

// Lo que hay escrito en el formulario, como un logro.
function delFormulario() {
  const $ = (id) => caja.querySelector(`#${id}`)
  const tipo = $('lgTipo')?.value || 'manual'
  const cond = { type: tipo }
  if ($('lgCuenta')) cond.count = Math.max(1, Number($('lgCuenta').value) || 1)
  else if (tipo !== 'manual') cond.count = 1
  const l = {
    ...abierto,
    id: $('lgId') ? $('lgId').value.trim() : abierto.id,
    title: $('lgTitulo').value.trim(),
    description: $('lgDesc').value.trim(),
    rarity: caja.querySelector('[data-lg-rareza].on')?.dataset.lgRareza || 'bronze',
    emoji: caja.querySelector('[data-lg-icono].on')?.dataset.lgIcono || abierto.emoji || 'trophy',
    icon_url: $('lgIconUrl').value.trim() || null,
    xp_reward: Math.max(0, Number($('lgXp').value) || 0),
    is_active: $('lgActivo').checked,
    condition: cond,
  }
  if (hayObjetivo) l.objetivo = $('lgObjetivo').value.trim() || null
  return l
}

function refrescarPrevia() {
  const l = delFormulario()
  caja.querySelector('#lgFrase').textContent = `«${objetivoAutomatico(l) || 'Sin frase automática para este tipo: escríbela abajo.'}»`
  caja.querySelector('#lgPrevia').innerHTML = previaHtml(l)
}

async function guardar() {
  const l = delFormulario()
  if (!l.title) return showToast('Ponle un nombre.')
  if (!/^[a-z0-9_]+$/.test(l.id)) return showToast('La clave va en minúsculas, números y «_» (por ejemplo, coleccion_100).')
  // Al crear (o duplicar) la clave se escribe: si ya es de otro logro, no se
  // guarda, que un upsert lo pisaría sin avisar.
  const creando = !!caja.querySelector('#lgId')
  if (creando && logros.some((x) => x.id === l.id)) return showToast('Ya hay un logro con esa clave: elige otra.')
  const nuevo = creando
  const fila = { id: l.id, title: l.title, description: l.description, emoji: l.emoji, icon_url: l.icon_url, rarity: l.rarity, xp_reward: l.xp_reward, is_active: l.is_active, condition: l.condition }
  if (hayObjetivo) fila.objetivo = l.objetivo
  const { error } = await supabase.from('achievement_definitions').upsert(fila)
  if (error) return showToast(`No se ha podido guardar: ${error.message}`)
  invalidateAchievementsCache()
  showToast(nuevo ? 'Logro creado.' : 'Logro guardado.', 'success')
  abierto = { ...l }
  await cargar()
}

async function borrar() {
  const l = abierto
  const n = personasDe(l.id)
  if (!confirm(`¿Borrar «${l.title}»?${n ? ` Lo tienen ${n} personas: dejará de salirles.` : ''} Si solo quieres que no se gane más, apágalo.`)) return
  const { error } = await supabase.from('achievement_definitions').delete().eq('id', l.id)
  if (error) return showToast(`No se ha podido borrar: ${error.message}`)
  invalidateAchievementsCache()
  abierto = null
  showToast('Logro borrado.', 'success')
  await cargar()
}

// ── Quién lo tiene ──

async function pintarQuien() {
  const zona = caja.querySelector('#lgQuien')
  if (!zona) return
  const id = abierto.id
  const [{ data: gente, error }, { data: aMano }] = await Promise.all([
    supabase.from('user_profiles').select('id, username, display_name').contains('achievements', [id]).order('username').limit(500),
    supabase.from('logros_a_mano').select('user_id, accion, motivo, created_at').eq('logro_id', id).order('created_at', { ascending: false }).then((r) => r, () => ({ data: null })),
  ])
  if (abierto?.id !== id || !caja.contains(zona)) return
  if (error) {
    zona.innerHTML = `<p class="admin-note admin-note-alerta">No se ha podido leer quién lo tiene: ${escapeHtml(error.message)}</p>`
    return
  }
  const notas = {}
  for (const f of aMano || []) if (!notas[f.user_id]) notas[f.user_id] = f
  const nombre = (p) => p.display_name || p.username || 'Sin nombre'
  zona.innerHTML = `
    <form class="lg-dar" id="lgDar" autocomplete="off">
      <label for="lgDarQuien" class="lg-eti">Dárselo a alguien</label>
      <div class="lg-fila"><input id="lgDarQuien" list="lgDarLista" placeholder="@usuario" required /><datalist id="lgDarLista"></datalist></div>
      <div class="lg-fila"><input id="lgDarMotivo" placeholder="Motivo (lo verá en el aviso)" /><button type="submit" class="btn-primary">Dar</button></div>
    </form>
    <p class="lg-eti">${(gente || []).length.toLocaleString('es-ES')} ${gente?.length === 1 ? 'persona' : 'personas'}${gente?.length === 500 ? ' (las 500 primeras)' : ''}</p>
    <ul class="lg-gente">${(gente || []).map((p) => {
      const nota = notas[p.id]
      const sub = nota?.accion === 'dar' ? `Se lo dio el equipo${nota.motivo ? ` · «${escapeHtml(nota.motivo)}»` : ''}` : ''
      return `<li data-lg-persona="${escapeHtml(p.id)}">
        <span class="lg-av">${escapeHtml((nombre(p)[0] || '?').toUpperCase())}</span>
        <span class="lg-quien-txt"><a href="/usuario/${encodeURIComponent(p.username || p.id)}" target="_blank" rel="noopener">${escapeHtml(nombre(p))}</a>${sub ? `<small>${sub}</small>` : ''}</span>
        <button type="button" class="btn-secondary" data-lg-quitar="${escapeHtml(p.id)}" data-nombre="${escapeHtml(nombre(p))}">Quitar</button>
      </li>`
    }).join('') || '<li class="admin-note">Nadie lo tiene todavía.</li>'}</ul>`

  const entrada = zona.querySelector('#lgDarQuien')
  entrada.addEventListener('input', async () => {
    const q = entrada.value.replace(/^@/, '').trim()
    if (q.length < 2) return
    const { data } = await supabase.from('user_profiles').select('username').ilike('username', `${q}%`).limit(8)
    zona.querySelector('#lgDarLista').innerHTML = (data || []).map((p) => `<option value="@${escapeHtml(p.username)}"></option>`).join('')
  })
  zona.querySelector('#lgDar').addEventListener('submit', async (e) => {
    e.preventDefault()
    const usuario = entrada.value.replace(/^@/, '').trim()
    const { data: p } = await supabase.from('user_profiles').select('id, username').ilike('username', usuario).maybeSingle()
    if (!p) return showToast(`No hay nadie que se llame @${usuario}.`)
    const { data, error: e2 } = await supabase.rpc('admin_logro_dar', { p_usuario: p.id, p_logro: id, p_motivo: zona.querySelector('#lgDarMotivo').value.trim() || null })
    if (e2) return showToast(/admin_logro_dar/.test(e2.message) ? 'Falta ejecutar la migración 1118.' : `No se ha podido dar: ${e2.message}`)
    showToast(data?.ya ? `@${p.username} ya lo tenía.` : `Se lo has dado a @${p.username}.`, 'success')
    await cargar()
    pestana = 'quien'
    pintar()
  })
  zona.querySelectorAll('[data-lg-quitar]').forEach((b) =>
    b.addEventListener('click', async () => {
      const motivo = prompt(`¿Por qué se lo quitas a ${b.dataset.nombre}? (opcional)`)
      if (motivo === null) return
      b.disabled = true
      const { error: e3 } = await supabase.rpc('admin_logro_quitar', { p_usuario: b.dataset.lgQuitar, p_logro: id, p_motivo: motivo.trim() || null })
      if (e3) {
        b.disabled = false
        return showToast(/admin_logro_quitar/.test(e3.message) ? 'Falta ejecutar la migración 1118.' : `No se ha podido quitar: ${e3.message}`)
      }
      showToast(`Se lo has quitado a ${b.dataset.nombre}.`, 'success')
      await cargar()
      pestana = 'quien'
      pintar()
    })
  )
}

// ── Los manejadores (se vuelven a poner en cada pintado) ──

function enganchar() {
  const buscar = caja.querySelector('#lgBuscar')
  buscar?.addEventListener('input', () => {
    busqueda = buscar.value
    const pos = buscar.selectionStart
    pintar()
    const nuevo = caja.querySelector('#lgBuscar')
    nuevo.focus()
    nuevo.setSelectionRange(pos, pos)
  })
  caja.querySelectorAll('[data-lg-filtro]').forEach((b) => b.addEventListener('click', () => { filtro = b.dataset.lgFiltro; pintar() }))
  caja.querySelectorAll('[data-lg]').forEach((b) => b.addEventListener('click', () => { abierto = { ...logros.find((l) => l.id === b.dataset.lg) }; pestana = 'datos'; pintar() }))
  caja.querySelector('[data-lg-nuevo]')?.addEventListener('click', () => { abierto = vacio(); pestana = 'datos'; pintar(); caja.querySelector('#lgTitulo')?.focus() })
  caja.querySelector('[data-lg-cerrar]')?.addEventListener('click', () => { abierto = null; pintar() })
  caja.querySelectorAll('[data-lg-pestana]').forEach((b) => b.addEventListener('click', () => { pestana = b.dataset.lgPestana; pintar() }))
  if (pestana === 'quien') { pintarQuien(); return }
  const form = caja.querySelector('#lgForm')
  if (!form) return
  form.addEventListener('submit', (e) => { e.preventDefault(); guardar() })
  form.addEventListener('input', refrescarPrevia)
  form.addEventListener('change', (e) => {
    // Cambiar a un tipo con o sin número cambia los campos: se repinta.
    if (e.target.id === 'lgTipo') { abierto = delFormulario(); pintar() }
  })
  for (const grupo of ['data-lg-icono', 'data-lg-rareza']) {
    form.querySelectorAll(`[${grupo}]`).forEach((b) =>
      b.addEventListener('click', () => {
        form.querySelectorAll(`[${grupo}]`).forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', String(x === b)) })
        refrescarPrevia()
      })
    )
  }
  form.querySelector('[data-lg-duplicar]')?.addEventListener('click', () => {
    const l = delFormulario()
    // La primera clave libre (`_2`, `_3`…): una que ya existe abriría ESE
    // logro para editarlo en vez de crear la copia.
    let n = 2
    while (logros.some((x) => x.id === `${l.id}_${n}`)) n++
    abierto = { ...l, id: `${l.id}_${n}`, title: `${l.title} (copia)`, is_active: false }
    pintar()
    caja.querySelector('#lgTitulo')?.select()
  })
  form.querySelector('[data-lg-borrar]')?.addEventListener('click', borrar)
}
