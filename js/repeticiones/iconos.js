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
  // Una nota del dueño en una jugada (tanda 495): la hoja con la esquina
  // doblada, que no se confunde con el bocadillo del foro.
  nota: (size) => icon('<path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z"></path><path d="M15 3v4a2 2 0 0 0 2 2h4"></path>', size),
  descargar: (size) => icon('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line>', size),
}
