# Workflow templates

GitHub Actions workflows que precisam de **passo manual** pra serem
ativados — o token usado pelo `gh` CLI atual não tem o scope `workflow`,
então o assistant não consegue fazer commit em `.github/workflows/`.

## Como ativar

1. Crie o diretório:
   ```bash
   mkdir -p .github/workflows
   ```
2. Mova o template desejado:
   ```bash
   mv docs/templates/e2e-workflow.yml .github/workflows/e2e.yml
   ```
3. Commit + push manualmente do seu próprio terminal (você tem o
   scope `workflow` no seu PAT/login):
   ```bash
   git add .github/workflows/e2e.yml
   git commit -m "ci: ativar Playwright smoke a cada push"
   git push
   ```
4. Verifique a aba "Actions" do GitHub — o primeiro run dispara
   automaticamente no próximo push.

## Workflows disponíveis

### `e2e-workflow.yml` → `.github/workflows/e2e.yml`

Roda os 24 cenários Playwright (desktop + mobile Pixel 5) contra
`https://scoreplace.app` em cada push pra `main`. Espera até 90s pelo
deploy do GitHub Pages propagar antes de testar. Upload do report HTML
+ screenshots/videos das falhas como artifact (retenção 14 dias).

**Não bloqueia o deploy** — GitHub Pages é processo separado. É um
quality gate informativo: se o smoke falha, vira issue na UI do GitHub
com link pro artifact.

### `prerender-workflow.yml` → `.github/workflows/prerender.yml`

Roda `npm run prerender` (script em `tools/prerender-landing.js`) que:
1. Sobe servidor local
2. Headless Chromium renderiza landing
3. Extrai HTML pronto e substitui o boot-skeleton no `index.html`
4. Commita automaticamente se houve mudança (com `[skip ci]` pra evitar loop)

Trigger: paths que afetam a landing (`landing.js`, `i18n*.js`, `style.css`,
`components.css`, `index.html`). Plus `workflow_dispatch` manual.

**Pré-requisitos antes de ativar:**
1. Modificar `router.js` pra detectar se há prerender ativo (sentinela
   `<!-- prerender:start -->` no DOM) e pular re-render quando user está
   deslogado E a rota é dashboard/landing. Caso contrário tem flicker.
2. Testar localmente com `npm run prerender:dry` (gera mas não escreve)
3. Quando aprovado: `npm run prerender` → commit manual pela primeira vez
4. Daí ativa o workflow pra automatizar regen futuro

## Roadmap

- `lighthouse.yml` — rodar Lighthouse CI a cada push, falha se
  Performance < threshold (a fazer)
- `firestore-backup.yml` — schedule cron diário pra backup do
  Firestore (a fazer, beta-readiness item #3)
