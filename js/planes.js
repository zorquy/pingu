// ¿Se le enseña al usuario la distinción entre contenido gratuito y Pro?
//
// Ahora mismo NO, y es una decisión de producto: PokeDoc es gratis. Poner
// "Gratis" en cada guía no informa de nada — lo que hace es sugerir que
// existe una versión de pago, que es justo lo contrario de lo que se
// quiere transmitir mientras el sitio esté abierto a todo el mundo.
//
// El interruptor está aquí, en un solo sitio, y NO se ha borrado nada:
// las columnas `is_pro` y `has_pro_content`, la tabla `guide_pro_content`
// y el editor de contenido Pro del panel de admin siguen existiendo tal
// cual. Si algún día hay planes, se pone esto a `true` y vuelve todo:
// las etiquetas, la pestaña de Guía Pro y el candado de los cursos.
//
// Mientras esté en `false`, una guía marcada como Pro se comporta como
// cualquier otra: se ve entera. Es a propósito — dejar el candado puesto
// pero quitarle la explicación sería enseñar una puerta cerrada sin decir
// por qué, que es peor que las dos alternativas.
export const MOSTRAR_PLANES = false
