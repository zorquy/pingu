// Las columnas de las cartas y las versiones de un set (978), en un fichero
// sin dependencias: las pide la web (`datos.js`) y la función que las sirve
// desde la CDN (`netlify/functions/cartas-set.mjs`). Una sola lista para
// las dos, que una columna que solo pide una llega `undefined` en la otra
// (la 523) y no da error.
//
// `category` desde la 382: sin ella el filtro de categoría del álbum tendría
// un desplegable vacío. `serie_id` desde la 434: hace falta para montar a
// mano la ruta del asset de TCGdex cuando `image_path` está a null.
// `release_date` desde la 953: sin ella la R de un set japonés nuevo salía
// «Normal» y no «Holo» (la regla de la 950 mira el día del set).
export const COLUMNAS_CARTA_DE_SET = 'id,market,set_id,local_id,name,name_es,name_en,image_path,image_scrydex,image_tcggo,rarity,rarity_en,category,variants,cm_id_product_propio,tp_id_product_propio,tcg_sets(tcg_online_code,serie_id,release_date)'

// `tcg_card_versions` (861): una fila por versión, con su etiqueta y su precio.
export const COLUMNAS_VERSION = 'tcggo_id,card_id,set_id,etiqueta,cm_id_product,link_cm,cm_low,cm_low_en,cm_low_de,cm_low_fr,cm_low_es,cm_low_it,cm_avg7,cm_avg30,cm_disponibles,tp_market_eur,tp_mid_eur,actualizado_at'
// Las de las versiones a mano (934), con respaldo (la 624): sin la migración
// no existen, y una consulta que las nombra falla ENTERA.
export const COLUMNAS_A_MANO = ',numero,imagen,icono,salio_en,lanzamiento,clase,origen'
export const faltanColumnasAMano = (texto) => /42703|imagen|salio_en|lanzamiento|clase|origen|icono|numero/.test(String(texto || ''))

// Un id de set que se puede meter en una consulta: el de TCGdex, el de
// TCGGO (`tcggo-123`) o uno a mano (`pcg-silver_ja`). Nada de comas ni
// paréntesis, que romperían el `in.(…)`.
export const esIdDeSet = (id) => /^[\w.-]{1,64}$/.test(String(id || ''))
