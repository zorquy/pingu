// Los iconos del reproductor de /repeticiones (tanda 462).
//
// Aquí y no en `js/icons.js` por lo mismo que los de /mi-coleccion (tanda
// 452): ese fichero lo baja la portada, que no tiene sitio, y estos solo
// se pintan en una pantalla. Mismo trazo y misma familia que los demás.
import { icon } from '../icons.js'

export const ICONOS_REPETICION = {
  reproducir: (size) => icon('<polygon points="7 4 19 12 7 20 7 4"></polygon>', size),
  pausa: (size) => icon('<rect x="6" y="4" width="4" height="16" rx="1"></rect><rect x="14" y="4" width="4" height="16" rx="1"></rect>', size),
  anterior: (size) => icon('<path d="m15 18-6-6 6-6"></path>', size),
  siguiente: (size) => icon('<path d="m9 18 6-6-6-6"></path>', size),
  turnoAnterior: (size) => icon('<polygon points="19 20 9 12 19 4 19 20"></polygon><line x1="5" y1="19" x2="5" y2="5"></line>', size),
  turnoSiguiente: (size) => icon('<polygon points="5 4 15 12 5 20 5 4"></polygon><line x1="19" y1="5" x2="19" y2="19"></line>', size),
}
