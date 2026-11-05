// /tiendas: el escaparate de escaparates (tanda 1244; la agenda era de la 1236).
// Pedir acceso tiene su página, /para-tiendas (js/para-tiendas.js); un enlace
// viejo a /tiendas#para-tiendas va allí.
import { montarAgenda } from './tiendas-agenda.js'

if (location.hash === '#para-tiendas') location.replace('/para-tiendas')
else void montarAgenda()
