// Caminho onde a página mora (barr4k.com/trader). Arquivos da pasta public e as rotas
// da API ficam debaixo dele, então caminhos "/foto.png" precisam ganhar o prefixo.
export const BASE = "/trader";

const local = (u: string) => u.startsWith("/") && !u.startsWith("//");

/** "/foto.png" → "/trader/foto.png" (pra mostrar) */
export const withBase = (u: string) => (u && local(u) && u !== BASE && !u.startsWith(BASE + "/") ? BASE + u : u);
/** "/trader/foto.png" → "/foto.png" (forma guardada no conteúdo salvo) */
export const stripBase = (u: string) => (u.startsWith(BASE + "/") ? u.slice(BASE.length) : u);
