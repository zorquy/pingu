// El Player ID de Play! Pokémon (tanda 834): cifras, hasta 10. Se acepta
// con espacios o guiones al escribirlo y se devuelve sin ellos; lo que no
// es un Player ID, null. Vive solo y sin dependencias porque lo usan el
// editor del perfil (que no debe bajarse el núcleo del constructor) y la
// hoja oficial (que se prueba en Node).
export function limpiarPlayerId(texto) {
  const s = String(texto ?? '').replace(/[\s-]/g, '')
  return /^\d{1,10}$/.test(s) ? s : null
}
