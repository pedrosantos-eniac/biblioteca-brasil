// Biblioteca Brasil - servidor Node.js + SQLite (sem pacotes externos)
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const PORTA = 3000;
const ADMIN = 'admin@exemplo.com';
const SENHA_ADMIN = '1234'; // Somente para demonstracao local
const arquivo = path.join(__dirname, 'dados', 'biblioteca.db');
if (!fs.existsSync(arquivo)) throw Error('Crie dados/biblioteca.db com schema.sql antes de iniciar.');
const db = new DatabaseSync(arquivo, { enableForeignKeyConstraints: true });

for (const tabela of ['usuarios', 'livros', 'leituras']) {
  if (!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(tabela)) {
    throw Error(`Tabela ausente: ${tabela}`);
  }
}
if (!db.prepare('PRAGMA table_info(usuarios)').all().some(c => c.name === 'email') ||
    !db.prepare('PRAGMA table_info(usuarios)').all().some(c => c.name === 'senha')) {
  throw Error('A tabela usuarios precisa das colunas email e senha.');
}

const sessoes = new Map();
function responder(res, status, dados, extras = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control':'no-store', ...extras });
  res.end(JSON.stringify(dados));
}
async function corpo(req) {
  let texto = '';
  for await (const parte of req) {
    texto += parte;
    if (texto.length > 16000) throw Error('Requisicao muito grande.');
  }
  return JSON.parse(texto || '{}');
}
function sessao(req) {
  const token = /(?:^|;\s*)bb_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
  const item = sessoes.get(token);
  if (!item || item.fim < Date.now()) return null;
  const usuario = item.id === 0
    ? { id_usuario: 0, nome: 'Administrador', perfil: 'admin' }
    : db.prepare("SELECT id_usuario, email, perfil FROM usuarios WHERE id_usuario=? AND perfil='usuario'").get(item.id);
  return usuario ? { usuario, token } : null;
}
function validarLivro(d) {
  return ['titulo','autor','genero'].every(k => typeof d[k] === 'string' && d[k].trim() && d[k].length <= 150)
    && Number.isSafeInteger(d.paginas) && d.paginas > 0 && d.paginas <= 100000;
}
function erroLeitura(d, total) {
  if (!['nao_iniciado','em_andamento','concluido'].includes(d.status)) return 'Status inválido.';
  if (!Number.isSafeInteger(d.pagina_atual) || d.pagina_atual < 0 || d.pagina_atual > total) return 'Página inválida.';
  if (d.status === 'nao_iniciado' && d.pagina_atual !== 0) return 'Não iniciado exige página zero.';
  if (d.status === 'concluido' && d.pagina_atual !== total) return 'Concluído exige todas as páginas.';
  if (d.status === 'em_andamento' && (d.pagina_atual <= 0 || d.pagina_atual >= total)) return 'Página intermediária obrigatória.';
  if (d.avaliacao != null && (!Number.isInteger(d.avaliacao) || d.avaliacao < 1 || d.avaliacao > 5)) return 'Avaliação inválida.';
  return null;
}

const paginas = ['index.html','admin.html','cadastro.html','biblioteca.html','painel.html','app.js','style.css'];
const tipo = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css' };

http.createServer(async (req, res) => {
  const rota = new URL(req.url, `http://localhost:${PORTA}`).pathname;
  const nome = rota === '/' ? 'index.html' : rota.slice(1);
  if (req.method === 'GET' && paginas.includes(nome)) {
    const caminho = path.join(__dirname, 'frontend', nome);
    if (!fs.existsSync(caminho)) return responder(res, 404, { erro:'Arquivo não encontrado.' });
    res.writeHead(200, { 'Content-Type':tipo[path.extname(nome)] + '; charset=utf-8' });
    return fs.createReadStream(caminho).pipe(res);
  }
  if (!rota.startsWith('/api/')) return responder(res, 404, { erro:'Página não encontrada.' });
  if (!['GET','POST','PATCH','DELETE'].includes(req.method)) return responder(res, 405, { erro:'Método inválido.' });
  if (req.method !== 'GET' && req.headers.origin && ![
    `http://localhost:${PORTA}`, `http://127.0.0.1:${PORTA}`
  ].includes(req.headers.origin)) return responder(res, 403, { erro:'Origem não permitida.' });

  const atual = sessao(req);
  const enviar = (status, valor, extra) => responder(res, status, valor, extra);
  const exigir = (perfil) => {
    if (!atual) { enviar(401, { erro:'Faça login.' }); return false; }
    if (perfil && atual.usuario.perfil !== perfil) {
      enviar(403, { erro:'Acesso não permitido.' }); return false;
    }
    return true;
  };

  try {
    if (rota === '/api/me' && req.method === 'GET') return enviar(200, atual?.usuario || null);

    if (rota === '/api/registrar' && req.method === 'POST') {
      const d = await corpo(req);
      const email = String(d.email || '').trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 200 || email === ADMIN ||
          typeof d.senha !== 'string' || d.senha.length < 4 || d.senha.length > 128) {
        return enviar(400, { erro:'Informe e-mail válido e senha de 4 a 128 caracteres.' });
      }
      if (db.prepare('SELECT id_usuario FROM usuarios WHERE email=?').get(email)) return enviar(409,{erro:'E-mail já cadastrado.'});
      db.prepare("INSERT INTO usuarios(email,senha,perfil) VALUES(?,?,'usuario')").run(email,d.senha);
      return enviar(201, { mensagem:'Conta criada. Faça login.' });
    }

    if (rota === '/api/login' && req.method === 'POST') {
      const d = await corpo(req);
      const email = String(d.email || '').trim().toLowerCase();
      const u = email === ADMIN && d.senha === SENHA_ADMIN
        ? { id_usuario:0, perfil:'admin' }
        : db.prepare("SELECT * FROM usuarios WHERE email=? AND perfil='usuario'").get(email);
      if (!u || u.id_usuario !== 0 && u.senha !== d.senha) return enviar(401,{erro:'Login ou senha incorretos.'});
      const token = crypto.randomBytes(32).toString('hex');
      sessoes.set(token, { id:u.id_usuario, fim:Date.now() + 8*60*60*1000 });
      return enviar(200, { perfil:u.perfil }, { 'Set-Cookie':`bb_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800` });
    }

    if (rota === '/api/logout' && req.method === 'POST') {
      if (atual) sessoes.delete(atual.token);
      return enviar(200, { ok:true }, { 'Set-Cookie':'bb_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' });
    }

    if (rota === '/api/livros' && req.method === 'GET') {
      return enviar(200, db.prepare('SELECT id_livro AS id,titulo,autor,genero,total_paginas AS paginas FROM livros ORDER BY titulo').all());
    }
    if (rota === '/api/livros' && req.method === 'POST') {
      if (!exigir('admin')) return;
      const d = await corpo(req);
      if (!validarLivro(d)) return enviar(400,{erro:'Dados do livro inválidos.'});
      const r = db.prepare('INSERT INTO livros(titulo,autor,genero,total_paginas) VALUES(?,?,?,?)')
        .run(d.titulo.trim(),d.autor.trim(),d.genero.trim(),d.paginas);
      return enviar(201,{id:Number(r.lastInsertRowid)});
    }
    const livroId = /^\/api\/livros\/(\d+)$/.exec(rota)?.[1];
    if (livroId && req.method === 'DELETE') {
      if (!exigir('admin')) return;
      db.prepare('DELETE FROM livros WHERE id_livro=?').run(+livroId);
      return enviar(200,{ok:true});
    }
    if (livroId && req.method === 'PATCH') {
      if (!exigir('admin')) return;
      const d = await corpo(req);
      if (!validarLivro(d)) return enviar(400,{erro:'Dados inválidos.'});
      if (db.prepare('SELECT 1 FROM leituras WHERE id_livro=? AND pagina_atual>?').get(+livroId,d.paginas))
        return enviar(409,{erro:'Há leituras acima do total de páginas.'});
      db.prepare('UPDATE livros SET titulo=?,autor=?,genero=?,total_paginas=? WHERE id_livro=?')
        .run(d.titulo.trim(),d.autor.trim(),d.genero.trim(),d.paginas,+livroId);
      return enviar(200,{ok:true});
    }

    if (rota === '/api/leituras' && req.method === 'GET') {
      if (!exigir('usuario')) return;
      const sql = `SELECT l.id_leitura,l.id_livro,l.status,l.pagina_atual,l.avaliacao,
        b.titulo,b.autor,b.genero,b.total_paginas AS paginas
        FROM leituras l JOIN livros b ON b.id_livro=l.id_livro
        WHERE l.id_usuario=? ORDER BY l.id_leitura DESC`;
      return enviar(200,db.prepare(sql).all(atual.usuario.id_usuario));
    }
    if (rota === '/api/leituras' && req.method === 'POST') {
      if (!exigir('usuario')) return;
      const d = await corpo(req);
      const livro = db.prepare('SELECT total_paginas FROM livros WHERE id_livro=?').get(d.id_livro);
      if (!livro) return enviar(404,{erro:'Livro inexistente.'});
      const erro = erroLeitura(d,livro.total_paginas);
      if (erro) return enviar(400,{erro});
      if (db.prepare('SELECT 1 FROM leituras WHERE id_usuario=? AND id_livro=?').get(atual.usuario.id_usuario,d.id_livro))
        return enviar(409,{erro:'O livro já está na sua biblioteca.'});
      db.prepare('INSERT INTO leituras(id_usuario,id_livro,status,pagina_atual,avaliacao) VALUES(?,?,?,?,?)')
        .run(atual.usuario.id_usuario,d.id_livro,d.status,d.pagina_atual,d.avaliacao ?? null);
      return enviar(201,{ok:true});
    }
    const leituraId = /^\/api\/leituras\/(\d+)$/.exec(rota)?.[1];
    if (leituraId && req.method === 'DELETE') {
      if (!exigir('usuario')) return;
      db.prepare('DELETE FROM leituras WHERE id_leitura=? AND id_usuario=?').run(+leituraId,atual.usuario.id_usuario);
      return enviar(200,{ok:true});
    }
    if (leituraId && req.method === 'PATCH') {
      if (!exigir('usuario')) return;
      const livro = db.prepare('SELECT b.total_paginas FROM leituras l JOIN livros b ON b.id_livro=l.id_livro WHERE l.id_leitura=? AND l.id_usuario=?')
        .get(+leituraId,atual.usuario.id_usuario);
      if (!livro) return enviar(404,{erro:'Leitura não encontrada.'});
      const d = await corpo(req);
      const erro = erroLeitura(d,livro.total_paginas);
      if (erro) return enviar(400,{erro});
      db.prepare('UPDATE leituras SET status=?,pagina_atual=?,avaliacao=? WHERE id_leitura=? AND id_usuario=?')
        .run(d.status,d.pagina_atual,d.avaliacao ?? null,+leituraId,atual.usuario.id_usuario);
      return enviar(200,{ok:true});
    }
    return enviar(404,{erro:'Rota não encontrada.'});
  } catch (erro) {
    console.error(erro.message);
    return enviar(400,{erro:'Não foi possível processar a solicitação.'});
  }
}).listen(PORTA,'127.0.0.1',()=>console.log(`Biblioteca Brasil: http://localhost:${PORTA}`));
