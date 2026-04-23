const fs = require('fs');
let c = fs.readFileSync('components/TopNav.tsx', 'utf8');
if (c.includes('Poiema</span>')) { console.log('logo encontrado'); } else { console.log('logo NAO encontrado'); }
c = c.replace(/label:'Movimentar'/g, "label:'Movimentação'");
c = c.replace(/Cadastros/g, 'Cadastro');
c = c.replace(/label:'Igrejas'/g, "label:'Igreja'");
c = c.replace(/label:'Ministérios'/g, "label:'Mural'");
c = c.replace(/label:'Usuários'/g, "label:'Usuário'");
fs.writeFileSync('components/TopNav.tsx', c, 'utf8');
console.log('done');
