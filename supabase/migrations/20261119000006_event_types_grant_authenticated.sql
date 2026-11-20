-- Concede permissões de acesso à tabela event_types para roles autenticados.
-- Sem este GRANT o cliente browser recebe array vazio mesmo com RLS correto.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.event_types TO authenticated;
GRANT SELECT ON TABLE public.event_types TO anon;
GRANT ALL ON TABLE public.event_types TO service_role;
