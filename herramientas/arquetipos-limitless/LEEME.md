# Los arquetipos de Limitless para `tcg_archetypes` (tanda 1460)

Ibai: «tráete todos los arquetipos de mazos de Limitless y añádelos a PokeDoc
para que haya más categorías de mazos». `tcg_archetypes` estaba vacía en
producción; la 1460 la llena con 148 arquetipos de Limitless
(`supabase-migration-1460-arquetipos-limitless.sql`, rama de trabajo).

## Rehacerlo con el meta de otro momento

1. Abre https://pokedoc.es (sin sesión vale), pega `derivar-en-navegador.js`
   entero en la consola y espera (unos minutos; la pestaña se congela
   mientras cuenta). Escribe en la consola cuánto acierta.
2. `copy(window.__compacto)` y guárdalo en un fichero (`compacto-AAAA.txt`).
   Mira a mano los nombres en español raros: el catálogo tiene alguna fila
   mal (en la 1460, «Zamazenta» como nombre español del Typhlosion de Eco).
3. `python3 generar-migracion.py compacto-AAAA.txt NNNN > supabase-migration-NNNN-arquetipos-limitless.sql`
   La migración no pisa lo que ya esté en la tabla (`on conflict do nothing`):
   para CAMBIAR uno que ya existe, se corrige en /admin → Torneos → Arquetipos.
4. Pasa `pruebas/test-tanda-1460.mjs` con el fichero nuevo (ajusta el 148).

## Qué hace

- Lee las listas enteras de `meta_resultados` (~5.000), `meta_arquetipos` y,
  para los que tienen menos de 3 listas, `meta_cartas_dia`.
- Cada arquetipo pide las cartas de sus iconos (con un 85 % de sus listas) y,
  si así se acierta más en todas, alguna más o un mínimo de copias; la regla
  con que se cuenta es la de la web (`arquetipoDelCatalogo`: gana el de más
  requisitos, a igualdad el id alfabético).
- Fuera el «other» y los Basic Box de Limitless (la web los reconoce sola).
- Dos ids con la misma regla (Limitless renombra): el visto más tarde.

`compacto-1460.txt` es el de la tanda 1460, ya con los dos arreglos a mano.
