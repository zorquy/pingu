// /tiendas: una tienda pide acceso (tanda 1067).
//
// Sin cuenta: la de la tienda se crea DESPUÉS, con la invitación que llega
// por correo cuando el equipo acepta (SCHEMA 1067). Lo guarda la base
// (`tienda_pedir`), que es quien valida, limita y avisa a la campanita del
// equipo; aquí solo se ayuda a rellenar bien a la primera.
import { supabase } from './supabase.js'
import { icons } from './icons.js'
import { validarSolicitud, instagramDe } from './tiendas-puro.js'

const $ = (id) => document.getElementById(id)

for (const el of document.querySelectorAll('.tiendas-icono[data-icono]')) {
  el.innerHTML = icons[el.dataset.icono]?.(22) || ''
}

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
