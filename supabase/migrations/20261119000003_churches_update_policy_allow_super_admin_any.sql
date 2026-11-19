-- Permite super_admin atualizar qualquer igreja (não apenas a sua)
-- Admin continua restrito à própria igreja
DROP POLICY IF EXISTS churches_update ON public.churches;
CREATE POLICY churches_update ON public.churches
  FOR UPDATE
  USING (
    (SELECT role FROM get_my_profile()) = 'super_admin'
    OR (
      id = (SELECT church_id FROM get_my_profile())
      AND (SELECT role FROM get_my_profile()) = 'admin'
    )
  );
