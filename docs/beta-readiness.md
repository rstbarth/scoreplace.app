# Beta-Readiness Checklist

**Versão atual:** v0.17.60-alpha
**Data:** 2026-04-28
**Status global:** alpha estável, infra de qualidade plugada (Sprint 1), mas ainda fora dos thresholds de release.

Este documento consolida o que falta entre o alpha atual e um beta confiável. Cada item é classificado por:
- 🚨 **Bloqueante** — não dá pra entrar em beta sem isto.
- 🟡 **Importante** — entrega beta sem, mas degrada qualidade percebida.
- 🟢 **Nice-to-have** — pode ficar pra v1.

---

## Sprint 1 (concluída) — Infra de qualidade

✅ Schemas Firestore documentados (`docs/schemas.md`)
✅ Code-debt audit (`docs/code-debt-audit.md` — zero TODOs ativos)
✅ Bundle audit + ship lazy release notes (`docs/bundle-audit.md`)
✅ Lighthouse baseline + defer em massa (`docs/lighthouse/`, FCP -51%)
✅ Playwright smoke (`tests/e2e/`, 3/3 passing)
✅ Sentry boilerplate (`js/sentry-init.js`, no-op até DSN ser plugada)

## Performance — onde queremos estar

| Métrica | Atual (v0.17.71) | Target beta | Target v1 | Status |
|---|---:|---:|---:|---|
| Performance Lighthouse | 64 | ≥ 75 | ≥ 90 | 🟡 |
| **Accessibility Lighthouse** | **100** 🎯 | ≥ 95 | ≥ 95 | ✅ |
| Best Practices | 96 | ≥ 95 | ≥ 95 | ✅ |
| SEO | 100 | ≥ 95 | ≥ 95 | ✅ |
| First Contentful Paint | 4.5s | ≤ 3.0s | ≤ 1.8s | 🟡 |
| Largest Contentful Paint | 9.4s | ≤ 4.0s | ≤ 2.5s | 🟡 |
| Speed Index | 4.5s | ≤ 3.5s | ≤ 3.4s | 🟡 |
| TTI | 9.4s | ≤ 5.0s | ≤ 3.8s | 🟡 |
| Bundle inicial (script transfer) | ~700KB gzipped | ≤ 500KB | ≤ 300KB | 🟡 |

## Itens pra fechar antes do beta

### 🚨 Bloqueantes

#### 1. **Reset de dados Firestore** (regra alpha → beta)
Hoje o CLAUDE.md autoriza dropar torneios/venues/users livremente. Antes de beta:
- [ ] Notificar amigos-testers que o reset está vindo
- [ ] Limpar `tournaments`, `venues`, `presences`, `casualMatches`, `mail` no console Firebase
- [ ] Manter `users` (perfis vão sobreviver a primeira leva de usuários reais)
- [ ] Documentar a partir daqui: "regra de não-quebrar-compat ativa"

#### 2. **Sentry DSN ativada**
Boilerplate plugado em `js/sentry-init.js` (v0.17.59). `_captureException`
plugado em 8 catches críticos (v0.17.61). Sem DSN, tudo é no-op.
- [x] Boilerplate Sentry inativo (silent no-op sem DSN)
- [x] `_captureException` em saves críticos (store, firebase-db, presence, auth, casual)
- [ ] Criar projeto em sentry.io (free tier)
- [ ] Descomentar a linha em `index.html` (`<script>window.SENTRY_DSN = "..."</script>`)
- [ ] Validar primeiro erro chegando ao dashboard do Sentry
- [ ] Smoke-test ainda passando após ativação

#### 3. **Backup automatizado do Firestore** ✅ scaffolding pronto
- [x] `backupFirestore` scheduled function em `functions/index.js` (v0.17.71)
- [x] Doc completo de setup em `docs/backup.md` (bucket + IAM + lifecycle 30d)
- [x] Runbook de restore (manual + automatizado)
- [ ] Rodar setup gcloud one-time (4 comandos em `docs/backup.md` §1)
- [ ] Deploy: `firebase deploy --only functions:backupFirestore`
- [ ] Validar primeiro run via Cloud Scheduler "Run now"
- [ ] Restore drill em ambiente isolado

#### 4. **Política de privacidade + Termos de uso visíveis** ✅ scaffolding pronto
- [x] Página `#privacy` com conteúdo placeholder estruturado por LGPD (v0.17.71)
- [x] Página `#terms` com termos típicos + banner alpha disclaimer
- [x] Footer da landing com links · separados
- [x] Modelo de "como apagar minha conta" — já existe (auth.js: excluir conta, v0.2.42)
- [ ] **Revisão jurídica do conteúdo placeholder** (advogado em LGPD/proteção de dados)
- [ ] Aceite explícito em primeiro login (modal/checkbox)

#### 5. **Quotas + alertas Firebase**
- [ ] Alertas via Firebase Alerts em: spike de leituras (>10x baseline), spike de writes (>5x), spike de erros 5xx
- [ ] Budget alert no Cloud Billing em $20, $50, $100 (hard cap pra alpha → beta)
- [ ] Documentar plano de ação se um alarme dispara (1 página)

### 🟡 Importantes

#### 6. **Performance: LCP < 4s** — parcialmente atacado
- [x] Skeleton estático no HTML (v0.17.62) — UX win, neutro em métricas
- [x] Static prerender da landing (v0.17.69) — implementado, LCP synthetic não moveu (medido honesto em `docs/lighthouse/README.md`)
- [x] Tooling de prerender automatizável via GitHub Action (`docs/templates/prerender-workflow.yml`)
- [ ] Lazy Firebase init — alto risco em auth flow, em DEFER aguardando revisão
- [ ] Critical CSS inlined — não atacado ainda

LCP atual: 9.4s. Target beta: ≤4s. Real gargalo é a quantidade de scripts
deferidos (40+) hidratando, não o conteúdo. Próximo passo real é
Firebase lazy init.

#### 7. **Reduzir bundle inicial em -100KB**
- [x] Lazy release notes (v0.17.56) — main.js 1.16MB → 152KB
- [x] Defer em massa (v0.17.58) — 45 scripts não-blocking, FCP -49%
- [ ] ~~Lazy i18n EN (v0.17.68)~~ revertido em v0.17.70 — IIFEs com `_t()` quebravam
- [ ] Lazy Firebase init — em DEFER

#### 8. **Cobertura E2E expandida** ✅ meta atingida
Hoje **17 cenários × 2 projects = 34 testes** em ~12s.
- [x] Smoke (3): home, help+lazy, PWA manifest
- [x] Navegação (4): rotas públicas, robots.txt, sitemap, rota inválida
- [x] Theme (1): cicla 4 temas + persistência
- [x] Observability+version (2): SCOREPLACE_VERSION exposta, Sentry inativo OK
- [x] Resilience (2): reload preserva tema, version === release-notes
- [x] i18n regression (4): modais sem keys cruas (caça regressão tipo v0.17.68)
- [x] Template GitHub Action (`docs/templates/e2e-workflow.yml`)
- [ ] Login fake-mode (alto valor, requer Firebase Auth emulator) — DEFER
- [ ] Criar torneio + lançar placar casual entre 2 tabs — DEFER

Meta original "≥10 cenários, runs em <60s" superada. CI green via template
ainda precisa ativação manual do workflow file.

#### 9. **Acessibilidade ≥ 95** ✅ atingido (96)
- [x] heading-order (h2 sr-only adicionado em v0.17.63)
- [x] select-name (aria-label nos 2 selects do perfil)
- [x] Form labels — 28 inputs corrigidos via `_toggleSwitch` helper + batch (v0.17.65)
- [x] Skip-nav já existe e foca corretamente
- [ ] color-contrast em 2 botões CTA da landing (weight 7) — escurecer gradiente btn-success ~10%, requer review nos 4 temas. Score subiria pra ~100. **Não bloqueante** (96 já passa target ≥95)

#### 10. **Logger centralizado** ✅ implementado (v0.17.67)
- [x] Wrapper em `js/logger.js` — `window._log/_warn/_error/_debug`
- [x] Modo prod (`hostname === 'scoreplace.app'`) silencia `_log/_debug`
- [x] Modo dev (localhost/preview) — verbose
- [x] Sentry breadcrumbs automáticos quando DSN plugada
- [x] `localStorage.scoreplace_debug='1'` força verbose em prod
- [ ] Migração de `console.*` legacy pra wrapper — refactor mecânico, ~200 calls em arquivos críticos. **Não-bloqueante** — wrapper é forwardo-compat, callers antigos continuam funcionando

### 🟢 Nice-to-have

#### 11. CSP headers (Content-Security-Policy)
- [ ] CSP via `<meta http-equiv>` (GitHub Pages não permite headers HTTP custom)
- [ ] Disallow inline JS (precisaria mover handlers `onclick=` pra event listeners — refactor grande)
- [ ] Allow somente CDNs whitelisted

#### 12. Service Worker: estratégia "stale-while-revalidate" pra HTML
Hoje o SW faz network-first. Mover pra stale-while-revalidate em alguns assets pode melhorar LCP em visitas subsequentes. Cuidado pra não servir HTML stale com versões antigas.

#### 13. Image optimization
- [ ] Logos servidos como SVG já são leves
- [ ] Mas avatar uploads de venues podem ficar grandes. Validar limites de tamanho no upload.

#### 14. PWA enhancements
- [ ] Shortcut handlers no manifest (Partida Casual, Novo Torneio direto da tela inicial do iOS)
- [ ] iOS install prompt com instruções claras (já tem doc na manual)

#### 15. Internacionalização — Espanhol
- [ ] LATAM tem demanda, ES seria 3º idioma. Adicionar `i18n-es.js` quando o lazy-load estiver implementado.

---

## Roadmap atualizado (2026-04-29)

### Sprint 1 ✅ FECHADA
Schema audit, code-debt audit, bundle audit + lazy release notes,
Lighthouse + defer (FCP -49%), Playwright smoke (3/3), Sentry boilerplate.

### Sprint 2 ✅ FECHADA
LCP skeleton, A11y 88→96, Logger centralizado, +9 cenários E2E,
prerender script + workflow, _captureException em 8 catches críticos,
Privacy+Terms scaffolding, Backup Firestore scaffolding, suite i18n
regression (4 cenários novos pra prevenir bugs tipo v0.17.68).

### Sprint 3 (próxima — depende de você)
Tudo o que sobrou exige decisão sua / setup externo:
- 🚨 #1 Reset Firestore + comunicar amigos-testers (1h)
- 🚨 #2 Criar projeto Sentry + plugar DSN (15min + smoke)
- 🚨 #3 Rodar setup IAM/bucket do backup + deploy função (30min, ver `docs/backup.md`)
- 🚨 #4 Revisão jurídica do conteúdo Privacy+Terms (advogado externo)
- 🚨 #5 Quotas + alertas Firebase + budget (2h, console Firebase)
- 🟡 #4 Aceite explícito de termos em primeiro login (1h código)
- 🟡 #6 Firebase init lazy — único path real pra Performance ≥75 (4h + revisão sua)
- 🟡 #9 Color-contrast btn-success (30min + screenshot review 4 temas)

### Sprint 4 (entrega beta)
- Bump versão pra `1.0.0-beta`
- Comunicado em todos os canais (Instagram, WhatsApp, etc.)
- Monitor 7 dias com Sentry ativo, sem regressões críticas
- Polishing residual

---

## Critério de saída pra beta

Tudo abaixo precisa estar verde:

- [ ] **Performance Lighthouse ≥ 75** em mobile slow-4G — atual 64. Gap fechado por Firebase lazy init.
- [x] **Acessibilidade Lighthouse ≥ 95** — atual **96** ✓ (v0.17.65)
- [ ] **0 erros JS no console** após smoke completo (login + criar + jogar + sair) — verificar manualmente quando você fizer review da Sprint 2
- [ ] **Sentry recebendo eventos reais** + 0 issues `unresolved` nas últimas 24h — DSN não plugada
- [x] **E2E suite ≥ 10 cenários, 100% green** — 17 cenários × 2 projects = 34 testes ✓
- [ ] **Backup Firestore** rodou nas últimas 24h, restore testado em isolado — scaffolding pronto, setup pendente
- [ ] **Política privacy + termos** publicados e linkados no footer — scaffolding publicado, conteúdo aguarda revisão jurídica
- [ ] **Reset de dados** comunicado e executado
- [ ] **Quotas Firebase** sem nenhum alarme nos últimos 7 dias — alertas não configurados ainda

**Estado atual: 2/9 verde. 4/9 com scaffolding pronto aguardando ativação. 3/9 dependem de decisão externa (jurídica, ops, comunicação).**

Quando tudo isto for `[x]`, a versão pode subir pra `1.0.0-beta`.
