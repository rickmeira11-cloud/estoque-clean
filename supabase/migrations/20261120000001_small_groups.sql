-- Tabela de grupos pequenos (células/grupos 2ou+)
CREATE TABLE public.small_groups (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id  uuid        NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  address    text,
  weekday    text        NOT NULL CHECK (weekday IN ('domingo','segunda','terca','quarta','quinta','sexta','sabado')),
  time       time        NOT NULL,
  is_active  boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.small_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY small_groups_select ON public.small_groups FOR SELECT
  USING (church_id IN (
    SELECT church_id FROM public.user_churches WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY small_groups_insert ON public.small_groups FOR INSERT
  WITH CHECK (
    church_id IN (SELECT church_id FROM public.user_churches WHERE user_id = auth.uid() AND is_active = true)
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','super_admin'))
  );

CREATE POLICY small_groups_update ON public.small_groups FOR UPDATE
  USING (
    church_id IN (SELECT church_id FROM public.user_churches WHERE user_id = auth.uid() AND is_active = true)
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','super_admin'))
  );

CREATE POLICY small_groups_delete ON public.small_groups FOR DELETE
  USING (
    church_id IN (SELECT church_id FROM public.user_churches WHERE user_id = auth.uid() AND is_active = true)
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','super_admin'))
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.small_groups TO authenticated;
GRANT SELECT ON TABLE public.small_groups TO anon;
GRANT ALL ON TABLE public.small_groups TO service_role;

-- Tabela de membros dos grupos pequenos
CREATE TABLE public.small_group_members (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  small_group_id uuid        NOT NULL REFERENCES public.small_groups(id) ON DELETE CASCADE,
  member_id      uuid        NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  role           text        NOT NULL DEFAULT 'member' CHECK (role IN ('leader','host','member')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (small_group_id, member_id)
);

ALTER TABLE public.small_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY small_group_members_select ON public.small_group_members FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.small_groups sg
    JOIN public.user_churches uc ON uc.church_id = sg.church_id
    WHERE sg.id = small_group_id AND uc.user_id = auth.uid() AND uc.is_active = true
  ));

CREATE POLICY small_group_members_insert ON public.small_group_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.small_groups sg
      JOIN public.user_churches uc ON uc.church_id = sg.church_id
      WHERE sg.id = small_group_id AND uc.user_id = auth.uid() AND uc.is_active = true
    )
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','super_admin'))
  );

CREATE POLICY small_group_members_delete ON public.small_group_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.small_groups sg
      JOIN public.user_churches uc ON uc.church_id = sg.church_id
      WHERE sg.id = small_group_id AND uc.user_id = auth.uid() AND uc.is_active = true
    )
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','super_admin'))
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.small_group_members TO authenticated;
GRANT SELECT ON TABLE public.small_group_members TO anon;
GRANT ALL ON TABLE public.small_group_members TO service_role;
