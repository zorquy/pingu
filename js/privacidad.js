// «Borrar lo que guarda PokeDoc en este dispositivo» (tanda 814, CK2).
//
// Borra las preferencias y la copia de ficheros del service worker, y deja
// la SESIÓN: quien pulsa esto quiere limpiar, no que se le cierre la cuenta
// sin avisar (para eso está «Cerrar sesión»). Las claves de Supabase empiezan
// por `sb-`. El service worker se queda: sin él se pierden los avisos.
export function clavesABorrar(claves) {
  return claves.filter((k) => !k.startsWith('sb-'))
}

export async function borrarLoGuardado({ almacen = localStorage, sesion = sessionStorage, cachesImpl = globalThis.caches } = {}) {
  const claves = []
  for (let i = 0; i < almacen.length; i++) claves.push(almacen.key(i))
  const fuera = clavesABorrar(claves.filter(Boolean))
  for (const k of fuera) almacen.removeItem(k)
  try { sesion.clear() } catch {}
  let copias = 0
  if (cachesImpl) {
    for (const k of await cachesImpl.keys()) {
      if (!k.startsWith('pokedoc-')) continue
      if (await cachesImpl.delete(k)) copias++
    }
  }
  return { preferencias: fuera.length, copias }
}

const boton = typeof document !== 'undefined' && document.getElementById('borrarLocal')
if (boton) {
  boton.addEventListener('click', async () => {
    const aviso = document.getElementById('borrarLocalAviso')
    boton.disabled = true
    try {
      const r = await borrarLoGuardado()
      aviso.textContent = `Hecho: ${r.preferencias} ${r.preferencias === 1 ? 'preferencia borrada' : 'preferencias borradas'} y la copia de la web vaciada. Tu sesión sigue abierta.`
    } catch {
      aviso.textContent = 'No se ha podido borrar todo. Puedes hacerlo desde los ajustes de tu navegador (datos del sitio).'
    } finally {
      boton.disabled = false
    }
  })
}
