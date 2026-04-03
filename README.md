# GM Pro Basketball Manager

Jogo manager inspirado no Brasfoot, focado em basquete profissional. Funciona offline, salva no `localStorage`, e roda em navegador desktop ou mobile.

## Como rodar

1. Abra o arquivo `index.html` no navegador.
2. Escolha seu time e comece a temporada.

## Modo Desktop (Electron / Steam-ready)

1. Instale as dependencias:
   - `npm install`
2. Rode:
   - `npm start`

No modo desktop, o salvamento fica em arquivo local (`saves.json`) dentro da pasta de dados do app.

## Controles principais

- `Novo Jogo`: reinicia a carreira.
- `Salvar` e `Carregar`: persistencia local.
- `Simular Proximo Jogo` ou `Simular 7 Dias`.
- `Menu GM`: acesso rapido a salvar, carregar perfil e logout.
- `Iniciar Nova Temporada`: encerra a offseason e gera a nova temporada.

## Recursos extras

- Login de perfis para salvar diferentes carreiras.
- Temporada de 82 jogos (calendario simplificado).
- Fadiga, energia e lesoes com status medico.
- Objetivos de diretoria com impacto no orcamento.
- Simulacao ao vivo com relato em tempo real.
- Draft completo em 2 rodadas com ordem de piores campanhas.
- Negociacao de contratos e trocas entre equipes.
- Instalacoes com upgrades que afetam evolucao e recuperacao.
- Calendario de selecoes (Olimpiadas e Copa do Mundo).
- Limite de carreira em 15 temporadas.
- Multiplas ligas jogaveis (NBA, NBB, EuroLeague, ACB, LNB).
- Identidade visual por time (cidade, cores e tecnico).
- Suporte a idioma PT/EN/ES via Menu GM.
- IA de front office (trocas, contratacoes e troca de tecnico).
- Transferencias internacionais entre ligas na offseason.
- Premiacoes de temporada e rivalidades.
- Sistema de torcida e arena influenciando receitas.

## Observacoes

- Times e jogadores sao ficticios.
- A temporada usa calendario simplificado (todos se enfrentam 2 vezes).
- Playoffs e offseason sao simulados automaticamente ao fim da temporada.
