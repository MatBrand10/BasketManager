# Steam templates

1. Gere o build desktop:
   - `npm install`
   - `npm run pack`
2. Substitua `YOUR_APP_ID` e `YOUR_DEPOT_ID` nos arquivos:
   - `steam/app_build.vdf`
   - `steam/depot_build.vdf`
3. Use o SteamCMD para subir o build com o script `steam/app_build.vdf`.

Observacao: o `ContentRoot` aponta para `dist/win-unpacked` (gerado pelo Electron Builder).
