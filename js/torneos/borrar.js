// Borrar un torneo (tandas 222 y 223), en un sitio para las dos
// pantallas que lo ofrecen: la ficha y la tarjeta de la lista.
//
// Vive aparte y no en comun.js porque necesita hablar con Supabase, y
// comun.js es a propósito un módulo sin dependencias que se puede
// probar en Node.
import { supabase } from '../supabase.js'

// El borrado tiene DOS caminos según haya gente dentro o no:
//
//  · Torneo vacío: se borra en el acto. No hay a quién avisar.
//
//  · Torneo con inscritos: se DIFIERE. Borrar en el acto se lleva por
//    delante la fila que dice quién estaba apuntado, y entonces ya no
//    hay a quién avisar ni desde dónde. Se deja cancelado con
//    `delete_after_notice_at`; el barredor, que sí tiene clave de
//    servicio para el push y el correo, avisa primero y borra después
//    —en la pasada siguiente, menos de un minuto—.
//
// Devuelve { error, diferido } para que quien llame diga lo que ha
// pasado de verdad y no «borrado» a secas cuando todavía se ve.
export async function borrarTorneo(torneoId, inscritosDentro = 0) {
  const diferido = inscritosDentro > 0
  const { error } = diferido
    ? await supabase
        .from('tournaments')
        .update({
          status: 'cancelled',
          delete_after_notice_at: new Date().toISOString(),
          // A cero por si el torneo ya estaba cancelado y avisado: el
          // aviso de que además desaparece hay que darlo igual.
          cancel_notified_at: null,
        })
        .eq('id', torneoId)
    : await supabase.from('tournaments').delete().eq('id', torneoId)
  return { error, diferido }
}

// El aviso se da SIEMPRE en la lista, nunca en la ficha: la página que
// lo mostraría es justo la que deja de existir. Se deja apuntado aquí y
// lo recoge torneos.js al cargar.
export function anunciarBorrado(nombre, inscritosDentro = 0) {
  sessionStorage.setItem('torneo-borrado', nombre)
  sessionStorage.setItem('torneo-borrado-inscritos', String(inscritosDentro))
}

// El texto del segundo toque: decir a cuánta gente afecta, que no es lo
// mismo borrar un torneo vacío que uno con ocho personas apuntadas.
export function textoConfirmarBorrado(inscritosDentro = 0) {
  return inscritosDentro
    ? `¿Seguro? Se avisa a ${inscritosDentro} inscrito${inscritosDentro === 1 ? '' : 's'} y se borra`
    : '¿Seguro? No hay vuelta atrás'
}
