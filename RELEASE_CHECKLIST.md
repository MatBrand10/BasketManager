# Release Checklist (Beta)

## Web/PWA
1. Testar no Chrome/Edge/Firefox (desktop + mobile).
2. Verificar salvamento (novo jogo, salvar, carregar).
3. Confirmar idioma PT/EN/ES no Menu GM.
4. Rodar simulação ao vivo e verificar performance.
5. Validar offline (carregar `index.html` direto).

## Desktop (Electron)
1. `npm install`
2. `npm run pack`
3. Testar `dist/win-unpacked` (abrir, salvar, carregar, simular).

## Steam (via SteamCMD)
1. Gerar build: `npm run dist:win`
2. Ajustar IDs em `steam/app_build.vdf` e `steam/depot_build.vdf`.
3. Subir via SteamCMD com o `app_build.vdf`.

## Conteudo
1. Verificar nomes ficticios e branding.
2. Capturar screenshots para a página do jogo.
3. Revisar textos (i18n) e feedbacks de erro.
