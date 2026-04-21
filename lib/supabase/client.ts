import { createClient as createSupabaseClient } from '@supabase/supabase-js'

let client: ReturnType<typeof createSupabaseClient> | null = null

export function createClient() {
  if (client) return client
  client = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        storageKey: 'sb-lggbgqqnguoacuilbugm-auth-token',
        storage: {
          getItem(key: string) {
            if (typeof document === 'undefined') return null
            const match = document.cookie.match(new RegExp('(^| )' + key + '=base64-([^;]+)'))
            if (!match) return null
            try { return JSON.stringify(JSON.parse(atob(match[2]))) } catch { return null }
          },
          setItem(key: string, value: string) {
            if (typeof document === 'undefined') return
            try {
              const encoded = btoa(JSON.parse(value) ? value : '{}')
              document.cookie = `${key}=base64-${encoded}; path=/; max-age=31536000; SameSite=Lax`
            } catch {}
          },
          removeItem(key: string) {
            if (typeof document === 'undefined') return
            document.cookie = `${key}=; path=/; max-age=0`
          },
        },
      },
    }
  )
  return client
}
