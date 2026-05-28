import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const chave = req.nextUrl.searchParams.get('chave')

  if (!chave || chave.length !== 44) {
    return NextResponse.json({ error: 'Chave inválida — deve ter 44 dígitos' }, { status: 400 })
  }

  // Tentar consultar via portal da SEFAZ Nacional (NF-e pública)
  // Esta consulta funciona para notas já autorizadas e publicadas
  try {
    const url = `https://www.nfe.fazenda.gov.br/portal/downloadNFe.aspx?chave=${chave}`
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/xml, text/xml, */*',
      },
      signal: AbortSignal.timeout(8000),
    })

    if (res.ok) {
      const text = await res.text()
      if (text.includes('<nfeProc') || text.includes('<NFe')) {
        return NextResponse.json({ xml: text })
      }
    }
  } catch {
    // SEFAZ indisponível ou requer autenticação
  }

  // Fallback: orientar upload manual
  return NextResponse.json({
    error: 'Não foi possível consultar automaticamente. O portal da SEFAZ pode exigir autenticação. Por favor, faça o download do XML na sua conta do portal da NF-e e importe manualmente.',
  }, { status: 422 })
}
