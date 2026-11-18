-- ─────────────────────────────────────────────────────────────────────
-- LOS ERRORES, LIMPIOS (tanda 1386).
--
-- Con el CSV de la 1385 delante (PINGU: «necesito arreglarlos»), casi todo
-- era ruido que no se arregla en PokeDoc. Desde la 1386 la web ya no lo
-- apunta (js/error-log.js `esRuido`, js/page-views.js `esFalloDeVerdad`), y
-- aquí se ordena lo que ya hay:
--
--   1. FUERA (se borra) lo que no es nuestro:
--      · el script de analítica de Netlify (`/.netlify/scripts/rum`): los
--        4.194 «Failed to fetch» eran suyos;
--      · extensiones y navegadores de dentro de otra app (carteras como
--        MetaMask o Talisman, `window.ethereum`, `__firefox__`, `_META` de
--        Instagram, `webkit.messageHandlers`, `iabjs://`, `M_ID`);
--      · los avisos de las transiciones entre páginas y el
--        `ResizeObserver loop`, que no son fallos;
--      · «Script error.» sin traza y los fallos de red sin un fichero
--        nuestro en la traza;
--      · las visitas que no se apuntaron por la red o por una sesión
--        caducada;
--      · los informes de CSP de connect.facebook.net (el navegador de dentro
--        de Facebook).
--   2. DESCARTADOS los desajustes de despliegue (una página con módulos de
--      dos versiones): la web ya se recarga sola, y si vuelve a pasar con
--      la versión nueva entra otra vez como nuevo.
--   3. REVISADOS los que están arreglados (en la 1386 o antes, o de ficheros
--      que ya no existen). Si vuelven a pasar, entran como nuevos.
--
-- Re-ejecutable (lo segundo y lo tercero solo tocan los `new`) y sin tablas
-- temporales (tanda 631): cada sentencia va sola.
-- ─────────────────────────────────────────────────────────────────────

-- 1. El ruido.
delete from public.client_errors
 where coalesce(stack, '') like '%/.netlify/scripts/%'
    or message ~ '^Script error\.?$'
    or message ~ '^(Transition was (aborted|skipped)|Skipping view transition|Old view transition aborted)'
    or message ~ '^ResizeObserver loop'
    or message ~ '(ethereum|__firefox__|_META|webkit\.messageHandlers|M_ID|MetaMask|Talisman|Java exception)'
    or coalesce(stack, '') ~ '(chrome|moz|safari|safari-web)-extension://|iabjs://'
    or message ~ '^No se pudo registrar la visita: .*(Failed to fetch|Load failed|NetworkError|JWT expired|network connection)'
    or (message like 'CSP%' and message ~ '(facebook\.net|facebook\.com|nsvcs\.net)')
    or (message ~ '^(TypeError: )?(Failed to fetch|Load failed|NetworkError when attempting to fetch resource\.?|The network connection was lost\.?)$'
        and coalesce(stack, '') !~ '/js/[A-Za-z0-9_./-]+\.js');

-- 2. Los desajustes de despliegue.
update public.client_errors
   set status = 'dismissed'
 where status = 'new'
   and message ~* '(Importing binding name|Indirectly exported binding name|does not provide an export named|doesn''t provide an export named|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|is not a valid JavaScript MIME type|\m(icons|datos|ctx)\.\w+ is not a function)';

-- 3. Los arreglados.
update public.client_errors
   set status = 'reviewed'
 where status = 'new'
   and (
        -- 1386: Ajustes que pintaba en una caja que ya no estaba.
        (coalesce(stack, '') like '%ajustes.js%' and message ~ '(innerHTML|value|textContent)')
        -- 1386: la franja de compartir de Mi colección y el botón del nivel.
     or message like '%mcPublicaEstado%' or coalesce(stack, '') like '%pintarCompartir%'
     or coalesce(stack, '') like '%loadHeader%'
        -- 1386: la carrera de premios de una repetición de un turno.
     or message like '%''premios''%'
        -- 1386: «Tienes N» de una ficha que ya se había cerrado.
     or coalesce(stack, '') like '%refrescarTengo%'
        -- De antes: ficheros que ya no existen o fallos ya arreglados.
     or coalesce(stack, '') like '%/js/torneos/torneo.js%'
     or coalesce(stack, '') like '%loadRecent%' or message like '%grid.innerHTML%' or message like '%grid is null%'
     or message like '%actividadCargada%'
     or message like '%currentInset%'
     or message = 'ReferenceError: Can''t find variable: CONFIG'
        -- 1361: el alta que fallaba por el disparador de user_profiles.
     or message like '%Database error saving new user%'
   );
