// /para-tiendas: una tienda pide acceso (tanda 1067; en su página desde la
// 1244, PINGU: «el formulario lo dejaría aparte»). La agenda de tiendas vive
// en /tiendas (js/tiendas.js).
//
// Sin cuenta: la de la tienda se crea DESPUÉS, con la invitación que llega
// por correo cuando el equipo acepta (SCHEMA 1067). Lo guarda la base
// (`tienda_pedir`), que es quien valida, limita y avisa a la campanita del
// equipo; aquí solo se ayuda a rellenar bien a la primera.
import { supabase } from './supabase.js'
import { icons } from './icons.js'
import { validarSolicitud, instagramDe } from './tiendas-puro.js'
import { PLANES, QUE_TRAE, ORDEN, FUNDADORAS_HASTA } from './tienda-plan-puro.js'

const $ = (id) => document.getElementById(id)

for (const el of document.querySelectorAll('main [data-icono]')) {
  el.innerHTML = icons[el.dataset.icono]?.(22) || ''
}

// Los planes (1429), de js/tienda-plan-puro.js: los precios en un solo sitio.
// Al año, diez meses (dos gratis). En el móvil, Tienda va la primera (CSS).
const visto = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M20 6 9 17l-5-5"/></svg>'
function pintarPlanes(anual = false) {
  const caja = $('ptPlanesCaja')
  if (!caja) return
  const fundadorasHasta = new Date(`${FUNDADORAS_HASTA}T00:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
  const aun = new Date() < new Date(`${FUNDADORAS_HASTA}T00:00:00`)
  const precio = (n) => (anual ? n * 10 : n)
  const tarjeta = (plan, i) => {
    const p = PLANES[plan]
    const rec = plan === 'tienda'
    return `<div class="pt-plan${rec ? ' pt-plan-rec' : ''}" data-plan="${plan}">
      ${rec ? '<span class="pt-plan-cinta">Recomendada</span>' : ''}
      <h3>${p.nombre}</h3>
      <p class="pt-plan-precio"><b>${precio(p.mes)} €</b><small>${p.mes ? (anual ? '/año' : '/mes') : 'para siempre'}</small></p>
      <p class="pt-plan-fund">${p.mes && aun ? `Fundadora: ${precio(p.fundadora)} €${anual ? '/año' : '/mes'} mientras sigas` : '&nbsp;'}</p>
      <p class="pt-plan-para">${p.para}</p>
      ${i ? `<p class="pt-plan-todo">Todo lo de ${PLANES[ORDEN[i - 1]].nombre}, y:</p>` : ''}
      <ul>${QUE_TRAE[plan].map((t) => `<li>${visto}<span>${t}</span></li>`).join('')}</ul>
      <a class="${rec ? 'btn-primary' : 'btn-secondary'}" href="#pide">${p.mes ? 'Pruébalo gratis' : 'Pide acceso'}</a>
    </div>`
  }
  caja.innerHTML = `${aun ? `<div class="pt-fund"><span class="pt-fund-ico" data-icono="star" aria-hidden="true">${icons.star(20)}</span><span><b>Tiendas fundadoras: un precio propio mientras sigas</b><small>Si entras antes del ${fundadorasHasta}. Si te das de baja y vuelves, pagas el de entonces.</small></span></div>` : ''}
    <div class="pt-periodo"><div class="seg" role="group" aria-label="Precio al mes o al año"><button type="button" class="seg-btn${anual ? '' : ' activa'}" data-pt-periodo="mes" aria-pressed="${!anual}">Al mes</button><button type="button" class="seg-btn${anual ? ' activa' : ''}" data-pt-periodo="anio" aria-pressed="${anual}">Al año</button></div><small>Al año, 2 meses gratis</small></div>
    <div class="pt-planes-rejilla">${ORDEN.map(tarjeta).join('')}</div>
    <p class="pt-planes-nota">Precios sin IVA. Sin permanencia: cambias de plan cuando quieras. PokeDoc no se queda nada de tus ventas.</p>`
}
pintarPlanes()
$('ptPlanesCaja')?.addEventListener('click', (e) => {
  const b = e.target.closest('[data-pt-periodo]')
  if (b) pintarPlanes(b.dataset.ptPeriodo === 'anio')
})

const form = $('tiendasForm')
form?.addEventListener('submit', async (e) => {
  e.preventDefault()
  const datos = {
    nombre: $('tiendasNombre').value.trim(),
    ciudad: $('tiendasCiudad').value.trim(),
    email: $('tiendasEmail').value.trim(),
    contacto: $('tiendasContacto').value.trim(),
    web: $('tiendasWeb').value.trim(),
    instagram: $('tiendasInstagram').value.trim(),
    tamano: $('tiendasTamano').value,
  }
  const error = $('tiendasError')
  error.textContent = ''
  const ig = datos.instagram ? instagramDe(/^@|instagram\.com/i.test(datos.instagram) ? datos.instagram : `@${datos.instagram}`) : null
  const mal = validarSolicitud(datos) || (datos.instagram && !ig ? 'Ese Instagram no parece un usuario: escribe solo tu @.' : null)
  if (mal) {
    error.textContent = mal
    return
  }
  const gracias = () => {
    $('tiendasGraciasEmail').textContent = datos.email
    form.classList.add('hidden')
    $('tiendasGracias').classList.remove('hidden')
  }
  // Un bot que rellena todo cae aquí: se le dice que sí y no se manda nada.
  if ($('tiendasPagina').value) return gracias()

  const boton = $('tiendasEnviar')
  boton.disabled = true
  boton.textContent = 'Enviando…'
  const base = {
    p_nombre: datos.nombre,
    p_ciudad: datos.ciudad || null,
    p_email: datos.email,
    p_contacto: datos.contacto || null,
    p_web: datos.web || null,
    p_tamano: datos.tamano,
  }
  // `p_instagram` llega con la 1074. Sin ella, la función de antes no lo
  // conoce (PGRST202): se manda sin él y el @ va en la web, como antes.
  let { error: fallo } = await supabase.rpc('tienda_pedir', ig ? { ...base, p_instagram: ig } : base)
  if (fallo?.code === 'PGRST202' && ig) {
    ({ error: fallo } = await supabase.rpc('tienda_pedir', { ...base, p_web: base.p_web || `@${ig}` }))
  }
  boton.disabled = false
  boton.textContent = 'Pedir acceso'
  if (fallo) {
    // Los motivos de la base ya vienen en español («Revisa que el email…»).
    // El de una función que aún no existe, no: eso es que falta la migración.
    error.textContent = /tienda_pedir|schema cache|does not exist/i.test(fallo.message || '')
      ? 'Ahora mismo no se pueden pedir cuentas de tienda. Prueba un poco más tarde.'
      : fallo.message || 'No se ha podido enviar. Inténtalo de nuevo.'
    return
  }
  gracias()
})
