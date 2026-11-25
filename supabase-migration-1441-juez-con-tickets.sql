-- Tanda 1441 — El panel de juez con tickets (Tardeo de Testeo, 25-11; Ibai:
-- «mejorar la interfaz de jueces y el sistema de tickets»).
--
-- Una llamada al juez dice QUÉ pasa (motivo y, si quiere, una línea) y, al
-- resolverla, el juez deja una nota de cómo quedó. Nada más: quién puede
-- llamar, atender y resolver sigue siendo lo de siempre (las políticas de
-- `judge_calls` no cambian).
--
-- Los motivos son los de `MOTIVOS` en js/torneos/jueces.js: si se añade uno,
-- va en los dos sitios.
--
-- Se puede ejecutar dos veces. Sin tablas temporales (tanda 631).

alter table public.judge_calls add column if not exists motivo text;
alter table public.judge_calls add column if not exists detalle text;
alter table public.judge_calls add column if not exists nota text;

alter table public.judge_calls drop constraint if exists judge_calls_motivo_check;
alter table public.judge_calls add constraint judge_calls_motivo_check
  check (motivo is null or motivo in ('ausente', 'desconexion', 'resultado', 'reglas', 'otro'));

alter table public.judge_calls drop constraint if exists judge_calls_detalle_largo;
alter table public.judge_calls add constraint judge_calls_detalle_largo
  check (detalle is null or char_length(detalle) <= 200);

alter table public.judge_calls drop constraint if exists judge_calls_nota_larga;
alter table public.judge_calls add constraint judge_calls_nota_larga
  check (nota is null or char_length(nota) <= 300);
