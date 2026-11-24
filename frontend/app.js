// Biblioteca Brasil - JavaScript do navegador
const $ = seletor => document.querySelector(seletor);
const criar = (tag, texto = '', classe = '') => {
  const item = document.createElement(tag);
  item.textContent = texto;
  item.className = classe;
  return item;
};

async function api(rota, metodo = 'GET', dados) {
  const resposta = await fetch('/api' + rota, {
    method: metodo,
    headers: { 'Content-Type': 'application/json' },
    body: dados ? JSON.stringify(dados) : undefined
  });
  const resultado = await resposta.json();
  if (!resposta.ok) throw Error(resultado.erro);
  return resultado;
}

let usuario;

async function iniciarMenu() {
  usuario = await api('/me');
  const admin = usuario?.perfil === 'admin';
  document.querySelectorAll('.navegacao a[href="biblioteca.html"], .navegacao a[href="cadastro.html"]')
    .forEach(link => link.hidden = admin);

  const link = $('.link-login');
  if (admin) {
    link.textContent = 'Painel Administrativo';
    link.href = 'painel.html';
  } else if (usuario) {
    link.hidden = true;
  } else {
    link.textContent = 'Entrar';
  }

  if (usuario) {
    const sair = criar('button', 'Sair da conta', 'botao botao-secundario');
    sair.type = 'button';
    sair.id = 'botao-logout';
    sair.onclick = async () => {
      try {
        await api('/logout', 'POST');
        location.href = 'index.html';
      } catch (erro) { alert(erro.message); }
    };
    $('.navegacao').append(sair);
  }
}

function loginPage() {
  if (usuario?.perfil === 'admin') return location.replace('painel.html');
  const mensagem = $('#aviso');
  const login = $('#login');
  const senha = $('#senha');
  $('#form-login').onsubmit = async evento => {
    evento.preventDefault();
    try {
      const dados = await api('/login', 'POST', { email: login.value, senha: senha.value });
      location.href = dados.perfil === 'admin' ? 'painel.html' : 'biblioteca.html';
    } catch (erro) { mensagem.textContent = erro.message; }
  };
  $('#registrar').onclick = async () => {
    try {
      await api('/registrar', 'POST', { email: login.value, senha: senha.value });
      mensagem.textContent = 'Conta criada! Agora clique em Entrar.';
    } catch (erro) { mensagem.textContent = erro.message; }
  };
}

async function adicionarPage() {
  if (usuario?.perfil === 'admin') return location.replace('painel.html');
  const livros = await api('/livros');
  const busca = $('#busca-livro'), lista = $('#resultados-busca');
  const form = $('#formulario-leitura'), status = $('#status'), pagina = $('#pagina_atual');
  const campoPagina = pagina.closest('.campo');
  let escolhido;
  status.innerHTML = '<option value="nao_iniciado">Não iniciado</option><option value="em_andamento">Em andamento</option>';

  function mostrarPagina() {
    const andamento = status.value === 'em_andamento';
    campoPagina.hidden = !andamento;
    pagina.disabled = !andamento;
    if (!andamento) pagina.value = 0;
    else if (+pagina.value <= 0 || +pagina.value >= escolhido.paginas) pagina.value = 1;
  }

  busca.oninput = () => {
    escolhido = null;
    $('#livro-selecionado').hidden = form.hidden = true;
    lista.replaceChildren();
    const termo = busca.value.trim().toLowerCase();
    if (!termo) return;
    const encontrados = livros.filter(l => (l.titulo + ' ' + l.autor).toLowerCase().includes(termo)).slice(0, 10);
    if (!encontrados.length) lista.append(criar('p', 'Nenhum livro encontrado.'));
    encontrados.forEach(livro => {
      const botao = criar('button', `${livro.titulo} — ${livro.autor}`, 'resultado-livro');
      botao.type = 'button';
      botao.onclick = () => {
        escolhido = livro;
        busca.value = livro.titulo;
        lista.replaceChildren();
        $('#livro-selecionado').hidden = form.hidden = false;
        $('#livro-titulo').textContent = livro.titulo;
        $('#livro-detalhes').textContent = `${livro.autor} · ${livro.genero} · ${livro.paginas} páginas`;
        pagina.max = livro.paginas;
        pagina.value = 0;
        status.value = 'nao_iniciado';
        mostrarPagina();
      };
      lista.append(botao);
    });
  };
  $('#trocar-livro').onclick = () => { busca.value = ''; busca.dispatchEvent(new Event('input')); busca.focus(); };
  status.onchange = mostrarPagina;
  campoPagina.hidden = true;
  $('#mensagem-cadastro').textContent = usuario ? '' : 'Faça login para adicionar livros.';
  form.onsubmit = async evento => {
    evento.preventDefault();
    try {
      if (!usuario) throw Error('Faça login antes de adicionar livros.');
      if (!escolhido) throw Error('Selecione um livro.');
      await api('/leituras', 'POST', {
        id_livro: escolhido.id, status: status.value,
        pagina_atual: status.value === 'nao_iniciado' ? 0 : Number(pagina.value), avaliacao: null
      });
      location.href = 'biblioteca.html';
    } catch (erro) { $('#mensagem-cadastro').textContent = erro.message; }
  };
}

function botao(texto, acao, classe = 'botao botao-secundario') {
  const b = criar('button', texto, classe);
  b.type = 'button';
  b.onclick = async () => { try { await acao(); } catch (erro) { alert(erro.message); } };
  return b;
}

async function bibliotecaPage() {
  if (usuario?.perfil === 'admin') return location.replace('painel.html');
  const grid = $('.grid-livros');
  let filtro = 'todos';
  const nomes = { nao_iniciado: 'Não iniciados', em_andamento: 'Em andamento', concluido: 'Concluídos' };

  async function atualizar() {
    grid.replaceChildren();
    if (!usuario) {
      $('#contador-livros').textContent = 'Faça login para acessar sua biblioteca.';
      const link = criar('a', 'Entrar', 'botao botao-primario');
      link.href = 'admin.html';
      grid.append(link);
      return;
    }
    const termo = $('#titulo').value.toLowerCase();
    const todos = await api('/leituras');
    const livros = todos.filter(l => (filtro === 'todos' || l.status === filtro) && l.titulo.toLowerCase().includes(termo));
    $('#contador-livros').textContent = `${livros.length} livro(s)`;
    grid.style.display = 'block';
    if (!livros.length) grid.append(criar('p', 'Nenhum livro encontrado.'));

    for (const [status, nome] of Object.entries(nomes)) {
      const grupo = livros.filter(l => l.status === status);
      if (!grupo.length) continue;
      const secao = criar('section', '', 'secao-biblioteca');
      const titulo = criar('h2', `${nome} (${grupo.length})`);
      const lista = criar('div', '', 'grid-livros');
      lista.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,290px),1fr));gap:20px';
      secao.style.marginBottom = '35px';
      secao.append(titulo, lista);
      grid.append(secao);

      grupo.forEach(l => {
        const card = criar('article', '', 'cartao-livro');
        card.append(criar('h3', l.titulo), criar('p', `${l.autor} · ${l.genero}`));
        if (status === 'concluido') {
          card.append(criar('p', '✓ Leitura concluída!'));
          if (l.avaliacao) card.append(criar('p', `Avaliação: ${'★'.repeat(l.avaliacao)}`));
        } else {
          card.append(criar('p', `Progresso: ${l.pagina_atual} de ${l.paginas} páginas`));
          const barra = document.createElement('progress');
          barra.max = l.paginas; barra.value = l.pagina_atual; barra.style.width = '100%';
          const select = document.createElement('select');
          select.innerHTML = '<option value="nao_iniciado">Não iniciado</option><option value="em_andamento">Em andamento</option>';
          select.value = l.status;
          const campoPag = criar('label', 'Página atual', 'campo');
          const pag = document.createElement('input');
          pag.type = 'number'; pag.min = 0; pag.max = l.paginas; pag.value = l.pagina_atual;
          campoPag.append(pag);
          const campoNota = criar('label', 'Avaliação', 'campo');
          const nota = document.createElement('select');
          for (let n = 0; n <= 5; n++) nota.add(new Option(n ? `${n} estrela(s)` : 'Sem avaliação', n || ''));
          nota.value = l.avaliacao ?? '';
          campoNota.append(nota);
          const mostrar = () => {
            campoPag.hidden = select.value === 'nao_iniciado';
            if (campoPag.hidden) pag.value = 0;
            else if (+pag.value <= 0 || +pag.value >= l.paginas) pag.value = 1;
          };
          select.onchange = mostrar;
          mostrar();
          const dados = (concluido = false) => ({
            status: concluido ? 'concluido' : select.value,
            pagina_atual: concluido ? l.paginas : select.value === 'nao_iniciado' ? 0 : Number(pag.value),
            avaliacao: nota.value ? Number(nota.value) : null
          });
          card.append(barra, select, campoPag, campoNota,
            botao('Salvar progresso', async () => { await api(`/leituras/${l.id_leitura}`, 'PATCH', dados()); await atualizar(); }, 'botao botao-primario'),
            botao('Marcar como concluído', async () => {
              if (!confirm(`Concluir "${l.titulo}"?`)) return;
              await api(`/leituras/${l.id_leitura}`, 'PATCH', dados(true)); await atualizar();
            })
          );
        }
        card.append(botao('Remover da minha lista', async () => {
          if (!confirm('Remover este livro da sua biblioteca?')) return;
          await api(`/leituras/${l.id_leitura}`, 'DELETE'); await atualizar();
        }));
        lista.append(card);
      });
    }
  }

  $('#titulo').oninput = atualizar;
  const filtros = [['btn-todos','todos'],['btn-nao-iniciados','nao_iniciado'],['btn-em-andamento','em_andamento'],['btn-concluidos','concluido']];
  filtros.forEach(([id, status]) => {
    $('#' + id).onclick = () => {
      filtro = status;
      document.querySelectorAll('.filtro-botao').forEach(b => b.classList.remove('selecionado'));
      $('#' + id).classList.add('selecionado');
      atualizar();
    };
  });
  await atualizar();
}

async function painelPage() {
  if (usuario?.perfil !== 'admin') return location.replace('admin.html');
  const form = $('#form-livro'), lista = $('#lista-catalogo');
  async function carregar() {
    lista.replaceChildren();
    const livros = await api('/livros');
    livros.forEach(l => {
      const card = criar('article', '', 'cartao-livro');
      card.append(criar('h3', l.titulo), criar('p', `${l.autor} · ${l.genero} · ${l.paginas} páginas`));
      card.append(botao('Editar', async () => {
        const titulo = prompt('Título', l.titulo); if (titulo === null) return;
        const autor = prompt('Autor', l.autor); if (autor === null) return;
        const genero = prompt('Gênero', l.genero); if (genero === null) return;
        const paginas = prompt('Páginas', l.paginas); if (paginas === null) return;
        await api(`/livros/${l.id}`, 'PATCH', { titulo, autor, genero, paginas: Number(paginas) });
        await carregar();
      }));
      card.append(botao('Excluir', async () => {
        if (!confirm('Excluir o livro? Isso remove as leituras vinculadas.')) return;
        await api(`/livros/${l.id}`, 'DELETE'); await carregar();
      }));
      lista.append(card);
    });
  }
  form.onsubmit = async evento => {
    evento.preventDefault();
    try {
      await api('/livros', 'POST', {
        titulo: $('#novo-titulo').value, autor: $('#novo-autor').value,
        genero: $('#novo-genero').value, paginas: Number($('#novas-paginas').value)
      });
      form.reset(); $('#aviso').textContent = 'Livro cadastrado!'; await carregar();
    } catch (erro) { $('#aviso').textContent = erro.message; }
  };
  await carregar();
}

(async () => {
  try {
    await iniciarMenu();
    const pagina = location.pathname.split('/').pop();
    if (usuario?.perfil === 'admin' && ['admin.html','biblioteca.html','cadastro.html'].includes(pagina)) {
      location.replace('painel.html'); return;
    }
    if (pagina === 'admin.html') loginPage();
    if (pagina === 'cadastro.html') await adicionarPage();
    if (pagina === 'biblioteca.html') await bibliotecaPage();
    if (pagina === 'painel.html') await painelPage();
  } catch (erro) { console.error(erro); alert('Erro ao carregar a página: ' + erro.message); }
})();
