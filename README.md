# Biblioteca Brasil — versão simplificada para a faculdade

Tecnologias: HTML5, CSS3, JavaScript, Node.js 22.13+ e SQLite.

## Arquivos alterados
- `frontend/app.js`: lógica de telas reduzida de 1063 para 287 linhas.
- `frontend/admin.html`: formulário fixo de login e cadastro.
- `frontend/painel.html`: formulário fixo do cadastro administrativo.
- `frontend/cadastro.html` e `frontend/biblioteca.html`: retirada de referencias a scripts inexistentes.
- `frontend/style.css`: uma regra `[hidden]` para ocultar campos corretamente.
- `server.js`: organização das rotas SQL e autenticação mais fácil de estudar.
- `schema.sql`: preservado.

## Como usar
1. Faca uma copia da pasta atual.
2. Substitua os arquivos de codigo pelos arquivos deste pacote.
3. **Nao substitua nem apague o seu arquivo `dados/biblioteca.db`**. Ele nao foi incluido no pacote de proposito.
4. Abra um terminal na raiz do projeto e execute `node server.js`.
5. Abra http://localhost:3001 e atualize com Ctrl+Shift+R.

O Node nao cria nem altera as tabelas. O banco existente precisa ter as colunas `email` e `senha` na tabela `usuarios`.
O login administrativo fixo e as senhas em texto simples sao apenas para testes locais com dados ficticios.

## Testes realizados
Cadastro e login de usuario, login admin, permissoes, cadastro de titulo, leitura pessoal, progresso, conclusao e logout — testados em **copia temporaria** do SQLite, sem modificar o banco original.
