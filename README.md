# Biblioteca Brasil

Projeto desenvolvido com HTML, CSS, JavaScript, Node.js e SQLite.

## Como executar

1. Abra a pasta do projeto no VS Code.
2. Verifique se o Node.js está instalado:

   ```bash
   node -v
   ```

3. Abra o terminal na pasta principal do projeto.
4. Execute o comando:

   ```bash
   node server.js
   ```

5. Abra o navegador e acesse:

   http://localhost:3000

## Banco de dados

O banco de dados fica na pasta `dados`, no arquivo `biblioteca.db`.

Ele já deve estar criado com as tabelas `usuarios`, `livros` e `leituras`.

O arquivo `schema.sql` contém o script com os comandos utilizados para criar as tabelas, caso seja necessário criar um banco novo.
