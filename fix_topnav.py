import sys

with open('components/TopNav.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remover "Poiema ·" do logo — deixar só churchName
logo_old = """            <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
              <span style={{fontSize:'13px',fontWeight:'600',color:'var(--text-1)',lineHeight:1,letterSpacing:'-0.01em'}}>Poiema</span>
              {churchName && (
                <>
                  <span style={{fontSize:'13px',color:'var(--text-3)'}}>·</span>
                  <span style={{fontSize:'13px',fontWeight:'500',color:'var(--brand-light)',lineHeight:1}}>{churchName}</span>
                </>
              )}
            </div>"""

logo_new = """            <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
              <span style={{fontSize:'13px',fontWeight:'600',color:'var(--brand-light)',lineHeight:1,letterSpacing:'-0.01em'}}>{churchName}</span>
            </div>"""

if logo_old in content:
    content = content.replace(logo_old, logo_new)
    print("✓ Logo corrigido")
else:
    print("✗ Logo nao encontrado — verifique manualmente")

# 2. Movimentar → Movimentação
if "label:'Movimentar'" in content:
    content = content.replace("label:'Movimentar'", "label:'Movimentação'")
    print("✓ Movimentar → Movimentação")
else:
    print("- Movimentar ja corrigido ou nao encontrado")

# 3. Cadastros → Cadastro (labels e textos JSX)
count = content.count('Cadastros')
content = content.replace('Cadastros', 'Cadastro')
print(f"✓ Cadastros → Cadastro ({count} ocorrencias)")

# 4. Plurais → singulares no NAV_CADASTROS
replacements = [
    ("label:'Igrejas'", "label:'Igreja'"),
    ("label:'Ministérios'", "label:'Ministério'"),
    ("label:'Usuários'", "label:'Usuário'"),
]
for old, new in replacements:
    if old in content:
        content = content.replace(old, new)
        print(f"✓ {old} → {new}")

with open('components/TopNav.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("\nArquivo salvo com sucesso!")
