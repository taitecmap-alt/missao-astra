# Missão Astra

Site estático para praticar inglês. A mascote é a Astra. A interface está em português do Brasil e as frases de prática estão em inglês.

Não há nomes de criança, responsável ou dados de inscrição neste repositório. O progresso fica só no navegador (`localStorage`). Nada é enviado a um servidor.

## Abrir no computador

Os módulos JavaScript não funcionam em `file://`. Sirva a pasta `site`:

```bash
npx serve site
```

Ou, a partir da pasta `site`:

```bash
python3 -m http.server 8080
```

## Publicar no GitHub Pages

O workflow [`.github/workflows/pages.yml`](.github/workflows/pages.yml) publica a pasta `site` com `actions/deploy-pages` em cada push na branch `main`.

**Ajuste único no GitHub:** Settings → Pages → Build and deployment → **Source: GitHub Actions**.

Enquanto a origem estiver em “Deploy from a branch”, ou o Pages estiver desligado, o workflow não consegue publicar.

URL esperada: <https://taitecmap-alt.github.io/missao-astra/>

Os caminhos do site são relativos (`css/styles.css`, `js/main.js`, `models/…`), então funcionam nesse endereço de projeto sem um build na hora do deploy. O pacote do three.js já está em `site/vendor/three-gltf.js`. Para gerar de novo:

```bash
npm install
npm run vendor
```

## O que tem no site

- Astra em 3D (three.js) caminhando, treinando e montando um robô. Toque nela para ela reagir. A animação pausa com a aba escondida e o pixel ratio fica limitado no celular.
- Painel com pontos, estrelas, nível, sequência de dias, missões e contagem até 15/04/2027.
- Painel do responsável atrás de uma conta simples, com histórico, exportação e apagar dados.
- Missões: Monte a frase, Ouvir e escolher, Conundrum e Vocabulário.
- Fale com a Astra: os cinco áudios inclusos tocam no botão Ouvir; outras frases usam a voz do navegador; o microfone compara a fala com uma pontuação tolerante e, se a API não existir, dá para digitar.
- PWA: manifest, ícones e service worker para abrir offline depois da primeira visita.

## Privacidade

O histórico exportado traz data, atividade e pontos. Não coloque nome de pessoa em issues, no site ou nos arquivos.
