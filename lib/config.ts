// Configuracao centralizada — nao usar IDs hardcoded nos componentes
// A igreja principal e identificada pela coluna is_main=true no banco

export const CONFIG = {
  // Remover este ID hardcoded gradualmente — usar profile.church?.is_main
  POIEMA_BNU_ID: '8db14705-9da8-4844-8b01-a73845297831',
} as const

// Helper para verificar se o usuario pertence a igreja principal
export function isMainChurch(churchId: string | null | undefined): boolean {
  return churchId === CONFIG.POIEMA_BNU_ID
}
