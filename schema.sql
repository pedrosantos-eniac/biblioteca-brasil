PRAGMA foreign_keys = ON;
CREATE TABLE usuarios (
 id_usuario INTEGER PRIMARY KEY AUTOINCREMENT,
 email TEXT NOT NULL UNIQUE,
 senha TEXT NOT NULL,
 perfil TEXT NOT NULL DEFAULT 'usuario' CHECK (perfil IN ('usuario', 'admin'))
);
CREATE TABLE livros (
 id_livro INTEGER PRIMARY KEY AUTOINCREMENT,
 titulo TEXT NOT NULL,
 autor TEXT NOT NULL,
 genero TEXT NOT NULL,
 total_paginas INTEGER NOT NULL CHECK (total_paginas > 0)
);
CREATE TABLE leituras (
 id_leitura INTEGER PRIMARY KEY AUTOINCREMENT,
 id_usuario INTEGER NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
 id_livro INTEGER NOT NULL REFERENCES livros(id_livro) ON DELETE CASCADE,
 status TEXT NOT NULL DEFAULT 'nao_iniciado' CHECK (status IN ('nao_iniciado','em_andamento','concluido')),
 pagina_atual INTEGER NOT NULL DEFAULT 0 CHECK(pagina_atual >= 0),
 avaliacao INTEGER CHECK(avaliacao BETWEEN 1 AND 5),
 UNIQUE (id_usuario, id_livro)
);
CREATE INDEX idx_livros_titulo ON livros(titulo);
CREATE INDEX idx_leituras_usuario ON leituras(id_usuario);
