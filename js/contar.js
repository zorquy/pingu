// Las cifras cuentan (tanda 783, MV2). Una cifra grande —lo que vale tu
// colección— sube (o baja) desde la que viste la última vez hasta la de hoy
// en 700 ms, y la línea de detrás se dibuja de izquierda a derecha.
//
// Solo la PRIMERA vez del día por cifra, para que no canse, y nunca la
// primera vez de todas: sin una cifra vista antes no hay de dónde contar, y
// contar desde cero sería inventarse una subida. Si ha bajado, baja.
//
// Llamarla otra vez sobre la misma caja corta la cuenta que vaya y deja la
// cifra nueva: el Panel la repinta al llegar los productos (766).
const MS = 700

export function contarCifra(el, clave, hasta, formato, grafica = null) {
  if (!el || !Number.isFinite(hasta)) return false
  const id = (el._contar = (el._contar || 0) + 1)
  const hoy = new Date().toISOString().slice(0, 10)
  let previo = null
  try { previo = JSON.parse(localStorage.getItem(`pd-cifra-${clave}`) || 'null') } catch { previo = null }
  try { localStorage.setItem(`pd-cifra-${clave}`, JSON.stringify({ dia: hoy, valor: hasta })) } catch { /* sin memoria, sin cuenta */ }
  const quieto = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const desde = Number(previo?.valor)
  if (quieto || !previo || previo.dia === hoy || !Number.isFinite(desde) || desde === hasta) {
    el.textContent = formato(hasta)
    return false
  }
  grafica?.setAttribute('data-dibujando', '')
  const t0 = performance.now()
  const paso = (t) => {
    if (el._contar !== id) return
    const k = Math.min(1, (t - t0) / MS)
    el.textContent = formato(k < 1 ? desde + (hasta - desde) * (1 - (1 - k) ** 3) : hasta)
    if (k < 1) requestAnimationFrame(paso)
  }
  el.textContent = formato(desde)
  requestAnimationFrame(paso)
  // Si la pestaña está en segundo plano no hay fotogramas: que la cifra
  // buena esté igual (la lección de la 313 con `animationend`).
  setTimeout(() => { if (el._contar === id) el.textContent = formato(hasta) }, MS + 200)
  return true
}
