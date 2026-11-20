-- Corrige RLS SELECT de event_types: troca get_my_profile() por user_churches
-- Motivo: get_my_profile() pode retornar NULL (profiles.church_id nulo),
-- fazendo church_id = NULL sempre FALSE e zerando a query no cliente.
-- Alinha com o padrão usado pela tabela members.
DROP POLICY IF EXISTS event_types_select ON public.event_types;
CREATE POLICY event_types_select ON public.event_types FOR SELECT
  USING (
    church_id IN (
      SELECT church_id FROM public.user_churches
      WHERE user_id = auth.uid() AND is_active = true
    )
  );
