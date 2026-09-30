// El rango de una persona y de qué color va su nombre (tanda 386).
//
// Aquí se decide y en ningún otro sitio: el nombre de alguien se pinta
// en media web y, si cada pantalla eligiera, dentro de dos tandas habría
// una sin enterarse — y un nombre en azul entre nombres en azul no
// canta. El porqué largo (los colores medidos, por qué el color va en un
// `style=` y no en una hoja) está en SCHEMA.md, tanda 386: este fichero
// lo baja la portada y el presupuesto no da para contarlo dos veces.
//
// Sin DOM y sin Supabase: se prueba en Node.

// Las columnas que hace falta traerse. Se exporta para que ninguna
// consulta se las invente: la que no las pida enseña a TODO EL MUNDO en
// azul, y eso no da error — parece que no hay ni un admin conectado.
export const COLUMNAS_RANGO = 'is_admin, is_moderator'

// De más alto a más bajo: quien es admin Y moderador sale como admin. El
// orden ES la regla, no un detalle de escritura.
const ESCALA = [
  { id: 'admin', campo: 'is_admin', nombre: 'Administrador' },
  { id: 'moderador', campo: 'is_moderator', nombre: 'Moderador' },
]

// null, y no 'normal': lo normal no se marca, y tener un nombre para
// ello invita a pintarlo de algo.
export function rangoDe(perfil) {
  return perfil ? ESCALA.find((r) => perfil[r.campo] === true)?.id || null : null
}

export function nombreDeRango(perfil) {
  const r = rangoDe(perfil)
  return ESCALA.find((x) => x.id === r)?.nombre || null
}

// La clase, para quien monta el elemento a mano: una @mención se
// construye con createElement y no con una plantilla. Vacía si no hay
// rango — su nombre ya es azul por ser enlace, y una clase que no cambia
// nada sería ruido en cada línea del foro.
export function claseDeRango(perfil) {
  const r = rangoDe(perfil)
  return r ? ` rango-${r}` : ''
}

// El color sale del id, así una escala nueva es UNA línea aquí y su par
// de tokens en style.css. La negrita va siempre: el color no puede ser
// lo único que lo dice.
export function estiloDeRango(perfil) {
  const r = rangoDe(perfil)
  return r ? `color: var(--rango-${r}); font-weight: 700` : ''
}

// Los atributos de un enlace a un perfil: clase, color y title. El href
// lo pone quien llama, que sabe si va a /perfil o a /usuario/<nombre>.
//
// `estiloBase` es para los sitios que YA traían un `style=` propio: dos
// atributos `style` en la misma etiqueta NO se suman —gana el primero y
// el segundo se tira—, así que se mezclan en una sola declaración y la
// del rango va detrás, que es quien tiene que ganar.
export function atributosDeRango(perfil, estiloBase = '') {
  const r = rangoDe(perfil)
  if (!r) return estiloBase ? ` style="${estiloBase}"` : ''
  const estilo = [estiloBase, estiloDeRango(perfil)].filter(Boolean).join('; ')
  return ` class="rango-${r}" style="${estilo}" title="${nombreDeRango(perfil)}"`
}
