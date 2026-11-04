// Las tarjetas del enlace de las páginas FIJAS (tanda 1201): las que no
// pasan por meta-social.js porque no dependen de ninguna fila (la portada, la
// agenda, el foro…). Su HTML apunta a /tarjeta/fija/<nombre>.png y la función
// `tarjeta` las dibuja con este texto. Una página fija nueva que se comparta
// lleva aquí su entrada y en su HTML esa dirección (lo mira la prueba 1201).
export const TARJETAS_FIJAS = {
  inicio: { seccion: 'inicio', chapa: 'Pokémon TCG', titulo: 'La comunidad *española* de Pokémon TCG', entradilla: 'Tu colección con precios, el foro, torneos, guías y un reto cada día.', linea: 'Gratis y en español', enlace: 'pokedoc.es', pieza: { tipo: 'mascota' } },
  eventos: { seccion: 'comunidad', chapa: 'Eventos', titulo: 'Card shows, trade days y *quedadas* en España', entradilla: 'La agenda de Pokémon TCG, y quién de PokeDoc va a cada uno.', linea: '¿Organizas uno? Avísanos y lo publicamos gratis', enlace: 'pokedoc.es/eventos', pieza: { tipo: 'mascota' } },
  foro: { seccion: 'comunidad', chapa: 'Foro', titulo: 'El foro de Pokémon TCG *en español*', entradilla: 'Mazos, colecciones, cambios, dudas de reglas y lo que salga.', linea: 'Entra y pregunta', enlace: 'pokedoc.es/foro', pieza: { tipo: 'mascota' } },
  cartas: { seccion: 'coleccion', chapa: 'Cartas', titulo: 'Todas las cartas de Pokémon TCG, *con su precio*', entradilla: 'Cada expansión, en español y japonés, con el precio de Cardmarket por idioma.', linea: 'Y apunta las tuyas para saber lo que vale tu colección', enlace: 'pokedoc.es/cartas', pieza: { tipo: 'mascota' } },
  aprender: { seccion: 'aprender', chapa: 'Aprender', titulo: 'Aprende a jugar *Pokémon TCG*', entradilla: 'Guías y cursos de la comunidad, desde cero hasta el torneo.', linea: 'Gratis y en español', enlace: 'pokedoc.es/aprender', pieza: { tipo: 'mascota' } },
  noticias: { seccion: 'inicio', chapa: 'Noticias', titulo: 'Noticias de Pokémon TCG *en español*', entradilla: 'Lanzamientos, torneos y todo lo que pasa en el juego.', linea: 'Cada día en PokeDoc', enlace: 'pokedoc.es/noticias', pieza: { tipo: 'mascota' } },
  gente: { seccion: 'comunidad', chapa: 'Gente', titulo: 'La gente de *PokeDoc*', entradilla: 'Coleccionistas y jugadores: qué buscan, qué cambian y qué guías escriben.', linea: 'Encuentra con quién cambiar', enlace: 'pokedoc.es/usuarios', pieza: { tipo: 'mascota' } },
  lanzamientos: { seccion: 'inicio', chapa: 'Calendario', titulo: 'Lo que sale de *Pokémon TCG*', entradilla: 'El calendario de lanzamientos, en España y en Japón.', linea: 'Con tu progreso en cada expansión', enlace: 'pokedoc.es/lanzamientos', pieza: { tipo: 'mascota' } },
  glosario: { seccion: 'aprender', chapa: 'Glosario', titulo: 'El diccionario de *Pokémon TCG*', entradilla: 'Qué significa cada palabra que se oye en una mesa de juego.', linea: 'Gratis y en español', enlace: 'pokedoc.es/glosario', pieza: { tipo: 'mascota' } },
  constructor: { seccion: 'jugar', chapa: 'Constructor', titulo: 'Monta tu mazo de *Pokémon TCG*', entradilla: 'Con las cartas legales, sus precios y lo que juega el meta.', linea: 'Y pruébalo en el laboratorio', enlace: 'pokedoc.es/constructor', pieza: { tipo: 'mascota' } },
  meta: { seccion: 'jugar', chapa: 'Meta', titulo: 'Los mazos que *ganan* ahora', entradilla: 'El meta de Pokémon TCG, con las listas de los torneos.', linea: 'Actualizado cada semana', enlace: 'pokedoc.es/meta', pieza: { tipo: 'mascota' } },
  laboratorio: { seccion: 'jugar', chapa: 'Laboratorio', titulo: 'Prueba tu mazo *antes del torneo*', entradilla: 'Roba manos, mira las probabilidades y juega turnos de prueba.', linea: 'Gratis en PokeDoc', enlace: 'pokedoc.es/laboratorio', pieza: { tipo: 'mascota' } },
  novedades: { seccion: 'inicio', chapa: 'Novedades', titulo: 'Lo nuevo de *PokeDoc*', entradilla: 'Cada cosa que añadimos o arreglamos, mes a mes.', linea: 'Hecho con lo que pide la comunidad', enlace: 'pokedoc.es/novedades', pieza: { tipo: 'mascota' } },
  tiendas: { seccion: 'comunidad', chapa: 'Tiendas', titulo: 'Las *tiendas* de PokeDoc', entradilla: 'Su stock, sus precios y cuáles tienen lo que buscas.', linea: 'Y si tienes una, pide tu cuenta', enlace: 'pokedoc.es/tiendas', pieza: { tipo: 'mascota' } },
  colabora: { seccion: 'comunidad', chapa: 'Colabora', titulo: 'Ayúdanos a hacer *PokeDoc*', entradilla: 'Escribe guías, corrige cartas o cuéntanos qué falta.', linea: 'La web la hace la comunidad', enlace: 'pokedoc.es/colabora', pieza: { tipo: 'mascota' } },
  sobre: { seccion: 'inicio', chapa: 'PokeDoc', titulo: 'Qué es *PokeDoc*', entradilla: 'La comunidad en español de Pokémon TCG: colección, foro, torneos y guías.', linea: 'Gratis y hecha por jugadores', enlace: 'pokedoc.es/sobre', pieza: { tipo: 'mascota' } },
}

// Qué página usa cada una (el HTML que la lleva en su og:image).
export const PAGINA_DE_FIJA = {
  inicio: 'index.html', eventos: 'eventos.html', foro: 'foro.html', cartas: 'cartas.html', aprender: 'aprender.html', noticias: 'noticias.html', gente: 'usuarios.html', lanzamientos: 'lanzamientos.html', glosario: 'glosario.html', constructor: 'constructor.html', meta: 'meta.html', laboratorio: 'laboratorio.html', novedades: 'novedades.html', tiendas: 'tiendas.html', colabora: 'colabora.html', sobre: 'sobre.html',
}
