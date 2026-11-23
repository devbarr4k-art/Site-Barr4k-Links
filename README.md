# Links do Barr4k

Página de links (estilo Linktree) do Barr4k: capa em vídeo, perfil, botões com cupom que copia, parceiros, cartões de destaque e chamada final. Painel em `/admin` edita tudo.

Next 16 + Tailwind 4. **Sem banco de dados**: o conteúdo fica num JSON no **Vercel Blob** (`site/config.json`) e os uploads do painel também vão pro Blob.

## Colocar no ar (Vercel)

1. Importar o repositório na Vercel.
2. **Storage → Create → Blob** e conectar ao projeto (cria a variável `BLOB_READ_WRITE_TOKEN` sozinha).
3. **Settings → Environment Variables**: `ADMIN_PASSWORD` = senha do painel.
4. Fazer um novo deploy (pra pegar as variáveis).
5. Abrir `/admin`, entrar com a senha, editar e **Salvar**.

Enquanto nada for salvo no painel, a página mostra o conteúdo padrão de `src/links.ts`.

## Rodar no PC

```
npm install
ADMIN_PASSWORD=teste npm run dev
```

Sem o token do Blob, o painel salva num arquivo na pasta temporária do PC (só pra testar) e o botão de upload fica desligado (dá pra colar o link da imagem).

## Arquivos

- `src/links.ts` — tipos e conteúdo padrão
- `src/lib/config.ts` — lê/salva o JSON no Blob e limpa o que vem do painel
- `src/app/page.tsx` — página pública
- `src/app/admin/Editor.tsx` — painel
- `public/` — artes padrão (capa, avatar, artes dos parceiros)
