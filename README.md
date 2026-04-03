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

### Builds (pack/dist)

- `npm run pack` (gera `dist/win-unpacked`)
- `npm run dist:win` (instalador + portable)
- `npm run dist:win:beta` (exe/instalador com nome Beta)
- `npm run dist:win:dev` (exe/instalador com nome Dev)
- `npm run dist:linux`
- `npm run dist:mac`

O icon utilizado no build vem de `assets/icon.png` e `assets/icon.ico` (Windows).
Para gerar o icon do macOS:
- `python -m pip install pillow`
- `npm run icon:icns`

## Splash

- O splash toca um FX curto na primeira interacao do usuario.
- As cores do splash seguem o ultimo time selecionado.

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
- Multiplas ligas jogaveis (Liga USA, Liga Brasil, Liga Europa, Liga Espanha, Liga Franca).
- Identidade visual por time (cidade, cores e tecnico).
- Suporte a idioma PT/EN/ES via Menu GM.
- IA de front office (trocas, contratacoes e troca de tecnico).
- Transferencias internacionais entre ligas na offseason.
- Premiacoes de temporada e rivalidades.
- Sistema de torcida e arena influenciando receitas.

## Steam (templates)

1. Gere o build desktop:
   - `npm install`
   - `npm run pack`
2. Os arquivos de template ficam em `steam/` para subir no Steamworks (substitua os IDs).

## Observacoes

- Times e jogadores sao ficticios.
- A temporada usa calendario simplificado (todos se enfrentam 2 vezes).
- Playoffs e offseason sao simulados automaticamente ao fim da temporada.
