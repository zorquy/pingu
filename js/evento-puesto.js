// ── El puesto de cambios (tanda 1426, «A» de «Modo evento y QR») ──
//
// Lo que ve quien escanea el QR del modo evento de alguien (/evento/<usuario>).
// PINGU: «quiero que sea muy visual y tal, y con filtros para buscar dentro de
// cada colección». Hasta la 1426 el QR abría el perfil entero por Cambios, y en
// el móvil las cartas llegaban a la segunda pantalla, detrás del nivel, el XP,
// las guías y los torneos; y el único filtro era el texto de «Ver todas».
//
// Aquí van las cartas primero: una cabecera de una línea (quién, su confianza,
// Proponer / Escribir o la puerta a la cuenta), «Da / Busca», el buscador y los
// filtros pegados arriba (los tuyos, expansión, rareza, precio y orden) y la
// rejilla. El cruce va en los sellos de las cartas («La buscas», «La das») y en
// una frase; el perfil completo, a un enlace. Lee lo MISMO que la pestaña
// Cambios (`listasDeCambios`, `fichasDeCambios`) y que el cruce
// (`datosDelCruce`): no hay otra consulta. Nada flota (1023): Proponer va en la
// cabecera.
import { escapeHtml, avatarStyle, getInitial, profileUrl } from './app.js'
import { hojaInyectada } from './hoja.js'
import { icons } from './icons.js'
import { normalizeSearch } from './texto.js'
import { nombreDeCarta, nombreDeSet } from './catalogo-series.js'
import { rarezaDeCarta } from './rarezas-nombres.js'
import { opcionesDe, filtrar, ordenar, cuentaDe, fraseDelCruce, ORDENES } from './evento-puesto-puro.js'

const opcion = (valor, texto, puesto) => `<option value="${escapeHtml(valor)}"${puesto ? ' selected' : ''}>${escapeHtml(texto)}</option>`

function cabeceraHtml(persona, sesion) {
  const nombre = persona.display_name || persona.username || 'Esta persona'
  const volver = encodeURIComponent(location.pathname + location.search)
  const acciones = sesion
    ? `<button type="button" class="btn-primary ep-proponer" data-ep-proponer disabled>${icons.arrowLeftRight(16)}<span>Proponer cambio</span></button>
       <a class="btn-secondary" href="/mensajes.html?with=${encodeURIComponent(persona.id)}" data-ep-escribir>${icons.mail(16)}<span>Escribir</span></a>`
    : `<a class="btn-primary" href="/auth.html?registro=1&volver=${volver}">Crear cuenta</a>
       <a class="btn-secondary" href="/auth.html?volver=${volver}">Entrar</a>`
  return `<header class="ep-cab">
      <a class="ep-quien" href="${escapeHtml(profileUrl(persona))}">
        <span class="ep-avatar" style="${avatarStyle(persona)}">${persona.avatar_url ? '' : escapeHtml(getInitial(nombre))}</span>
        <span class="ep-nombre"><b>${escapeHtml(nombre)}</b><small>${persona.username ? `<span>@${escapeHtml(persona.username)}</span>` : ''}<span class="ep-confianza" data-confianza="${escapeHtml(persona.id)}"></span></small></span>
      </a>
      <div class="ep-acciones">${acciones}</div>
    </header>
    <p class="ep-cruce" data-ep-cruce>${sesion ? 'Mirando lo que os podéis cambiar…' : `Crea tu cuenta, apunta tus cartas y te digo qué os podéis cambiar ${escapeHtml(nombre)} y tú.`}</p>`
}

function mandosHtml(cuentas) {
  return `<div class="ep-mandos">
      <div class="seg ep-seg" role="group" aria-label="Qué lista ver">
        <button type="button" class="seg-btn activa" aria-pressed="true" data-ep-lista="da">Da <span class="ep-n">${cuentas.da}</span></button>
        <button type="button" class="seg-btn" aria-pressed="false" data-ep-lista="busca">Busca <span class="ep-n">${cuentas.busca}</span></button>
      </div>
      <label class="sr-only" for="epBuscar">Buscar en la lista</label>
      <input type="search" class="ep-busca" id="epBuscar" enterkeyhint="search" autocomplete="off" placeholder="Busca por nombre, expansión o número" />
      <div class="ep-chips" data-ep-chips></div>
    </div>
    <p class="ep-cuenta" aria-live="polite" data-ep-cuenta></p>`
}

export async function montarPuesto(caja, persona, sesion) {
  if (!caja || !persona?.id) return
  hojaInyectada('css/perfil-cambios.css')
  hojaInyectada('css/evento-puesto.css')
  caja.innerHTML = `<section class="ep-puesto" aria-label="Lo que cambia ${escapeHtml(persona.display_name || persona.username || '')}">
      ${cabeceraHtml(persona, sesion)}
      <div data-ep-cuerpo><div class="skeleton" style="height: 320px;"></div></div>
    </section>`
  import('./cambios-hechos.js').then((m) => m.ponerConfianza(caja)).catch(() => {})

  const pc = await import('./perfil-cambios.js')
  const cuerpo = caja.querySelector('[data-ep-cuerpo]')
  let listas
  try {
    listas = await pc.listasDeCambios(persona, sesion)
  } catch {
    cuerpo.innerHTML = '<p class="empty-state">No se ha podido mirar ahora. Prueba otra vez en un momento.</p>'
    return
  }
  const nombre = persona.display_name || persona.username || 'Esta persona'
  const cuentas = { da: listas.filasDa.length, busca: listas.filasBusca.length }
  if (!cuentas.da && !cuentas.busca) {
    cuerpo.innerHTML = `<p class="empty-state">Ahora mismo ${escapeHtml(nombre)} no da ni busca ninguna carta.</p>
      <p class="ep-perfil"><a href="${escapeHtml(profileUrl(persona))}">Ver el perfil de ${escapeHtml(nombre)}</a></p>`
    return
  }
  const fichas = await pc.fichasDeCambios(listas)

  // Cada carta, una vez: su baldosa (la de la pestaña Cambios) y lo que filtra.
  const itemDe = (f, i, lado) => {
    const c = fichas.cartaDe(f)
    const sello = lado === 'da' ? fichas.selloDa(f) : fichas.selloBusca(f)
    const precio = Number(fichas.valor(f))
    const setNombre = c ? nombreDeSet(c.tcg_sets) || c.set_id || '' : ''
    const nombreCarta = c ? nombreDeCarta(c) : f.card_id
    return {
      i, sello, nombre: nombreCarta, set: c?.set_id || '', setNombre,
      rareza: c ? rarezaDeCarta(c) || '' : '',
      precio: Number.isFinite(precio) && precio > 0 ? precio : null,
      texto: normalizeSearch([nombreCarta, setNombre, c?.set_id || '', c?.local_id || ''].join(' ')),
      html: pc.baldosaHtml(f, c, { sello, precio: pc.euros(fichas.valor(f)), deseo: lado === 'busca', cuanto: lado === 'da' ? `Da ${f.total} · ` : '' }),
    }
  }
  const items = {
    da: listas.filasDa.map((f, i) => itemDe(f, i, 'da')),
    busca: listas.filasBusca.map((f, i) => itemDe(f, i, 'busca')),
  }
  const textoSolo = { da: 'La buscas', busca: 'Las tienes' }
  // La lista que se abre: la que tiene algo tuyo; si no, la que tiene cartas.
  const conSello = (l) => items[l].some((x) => x.sello)
  // Sin cuenta no hay «lo tuyo»: se abre por las más caras.
  const ordenes = sesion ? ORDENES : ORDENES.filter((o) => o.clave !== 'tuyo')
  const ordenDeSalida = ordenes[0].clave
  const est = { lista: cuentas.da && (conSello('da') || !conSello('busca')) ? 'da' : 'busca', q: '', set: '', rareza: '', precio: '', orden: ordenDeSalida, solo: false }
  if (!cuentas[est.lista]) est.lista = est.lista === 'da' ? 'busca' : 'da'

  cuerpo.innerHTML = `${listas.lista ? `<p class="ep-lista-aviso">${listas.lista.nombre ? `La lista «${escapeHtml(listas.lista.nombre)}»` : 'Una lista'} de lo que busca · <a href="${escapeHtml(location.pathname)}">Ver todo</a></p>` : ''}
    ${listas.sinMigracion ? '<p class="subtext">Lo que da todavía no se puede enseñar.</p>' : ''}
    ${mandosHtml(cuentas)}
    <ul class="pc-rejilla ep-rejilla" data-ep-rejilla></ul>
    <p class="ep-perfil"><a href="${escapeHtml(profileUrl(persona))}">Ver el perfil completo de ${escapeHtml(nombre)}</a></p>`

  const $ = (s) => cuerpo.querySelector(s)
  const pintarChips = () => {
    const op = opcionesDe(items[est.lista])
    // Un valor que ya no existe en esta lista se suelta (de Da a Busca).
    if (est.set && !op.sets.some((x) => x.clave === est.set)) est.set = ''
    if (est.rareza && !op.rarezas.some((x) => x.clave === est.rareza)) est.rareza = ''
    if (est.precio && !op.tramos.some((x) => x.clave === est.precio)) est.precio = ''
    if (!op.conSello) est.solo = false
    // Un desplegable con cara de chip (1426): se lee la opción puesta en letra
    // de chip y el <select> del sistema va encima, transparente, para tocarlo.
    const sel = (clave, rotulo, todas, opciones, valor, puesto = !!valor) => {
      const elegida = opciones.find((o) => o.clave === valor)
      return `<label class="ep-chip ep-select${puesto ? ' ep-puesto-on' : ''}">
        <span class="ep-select-txt">${escapeHtml(elegida ? elegida.nombre : todas)}</span><span class="ep-flecha" aria-hidden="true"></span>
        <select data-ep="${clave}" aria-label="${rotulo}">${todas !== null ? opcion('', todas, !valor) : ''}${opciones.map((o) => opcion(o.clave, o.n != null ? `${o.nombre} · ${o.n}` : o.nombre, o.clave === valor)).join('')}</select>
      </label>`
    }
    $('[data-ep-chips]').innerHTML = `
      ${op.conSello ? `<button type="button" class="ep-chip${est.solo ? ' ep-puesto-on' : ''}" aria-pressed="${est.solo}" data-ep-solo>${icons.heart(14)}<span>${textoSolo[est.lista]} · ${op.conSello}</span></button>` : ''}
      ${op.sets.length > 1 ? sel('set', 'Expansión', 'Expansión', op.sets, est.set) : ''}
      ${op.rarezas.length > 1 ? sel('rareza', 'Rareza', 'Rareza', op.rarezas, est.rareza) : ''}
      ${op.tramos.length > 1 ? sel('precio', 'Precio', 'Precio', op.tramos, est.precio) : ''}
      ${sel('orden', 'Orden', null, ordenes, est.orden, est.orden !== ordenDeSalida)}`
  }
  const pintar = () => {
    const todas = items[est.lista]
    const vistas = ordenar(filtrar(todas, est), est.orden)
    $('[data-ep-rejilla]').innerHTML = vistas.map((x) => x.html).join('') || '<li class="pc-vacio ep-nada">Nada con estos filtros. <button type="button" class="link-btn" data-ep-limpiar>Quitar los filtros</button></li>'
    $('[data-ep-cuenta]').textContent = cuentaDe(vistas, todas.length, pc.euros)
    for (const b of cuerpo.querySelectorAll('[data-ep-lista]')) {
      const si = b.dataset.epLista === est.lista
      b.classList.toggle('activa', si)
      b.setAttribute('aria-pressed', String(si))
    }
  }
  pintarChips()
  pintar()

  cuerpo.addEventListener('click', (e) => {
    const lado = e.target.closest('[data-ep-lista]')
    if (lado && lado.dataset.epLista !== est.lista) {
      est.lista = lado.dataset.epLista
      // «La buscas» y «Las tienes» son chips distintos: se suelta al cambiar.
      est.solo = false
      pintarChips()
      pintar()
      return
    }
    if (e.target.closest('[data-ep-solo]')) {
      est.solo = !est.solo
      pintarChips()
      pintar()
      return
    }
    if (e.target.closest('[data-ep-limpiar]')) {
      Object.assign(est, { q: '', set: '', rareza: '', precio: '', solo: false })
      $('#epBuscar').value = ''
      pintarChips()
      pintar()
    }
  })
  cuerpo.addEventListener('change', (e) => {
    const s = e.target.closest('select[data-ep]')
    if (!s) return
    est[s.dataset.ep] = s.value
    pintarChips()
    pintar()
  })
  $('#epBuscar').addEventListener('input', (e) => {
    est.q = normalizeSearch(e.target.value || '').trim()
    pintar()
  })

  // El cruce: la frase de arriba y «Proponer cambio» ya relleno.
  const frase = caja.querySelector('[data-ep-cruce]')
  if (!sesion) return
  if (sesion.user.id === persona.id) {
    frase.textContent = 'Tu QR funciona: quien lo escanee verá esto, con lo que os podéis cambiar.'
    caja.querySelector('[data-ep-proponer]')?.remove()
    caja.querySelector('[data-ep-escribir]')?.remove()
    return
  }
  try {
    const cp = await import('./cruce-persona.js')
    const cruce = await cp.datosDelCruce(persona)
    const teDa = new Set(cruce.teDa.map((f) => f.card_id)).size
    const leDas = new Set(cruce.leDas.map((f) => f.card_id)).size
    frase.textContent = fraseDelCruce(teDa, leDas, nombre)
    frase.classList.toggle('ep-cruce-hay', teDa + leDas > 0)
    const proponer = caja.querySelector('[data-ep-proponer]')
    if (proponer) {
      proponer.disabled = false
      proponer.addEventListener('click', () => cp.proponerConElCruce(sesion, persona, cruce))
    }
    if (teDa + leDas > 0) {
      const escribir = caja.querySelector('[data-ep-escribir]')
      if (escribir) escribir.href = await cp.enlaceParaEscribir(persona, cruce.teDa, cruce.leDas, cruce.cartas)
    }
  } catch {
    frase.textContent = 'No se ha podido mirar qué os podéis cambiar. Las cartas de abajo sí están al día.'
    const proponer = caja.querySelector('[data-ep-proponer]')
    if (proponer) {
      proponer.disabled = false
      proponer.addEventListener('click', async () => (await import('./cambio-propuesta.js')).abrirPropuesta({ sesion, otro: persona }))
    }
  }
}
