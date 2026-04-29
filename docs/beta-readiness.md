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

| Métrica | Atual (v0.17.60) | Target beta | Target v1 |
|---|---:|---:|---:|
| Performance Lighthouse | 64 | ≥ 75 | ≥ 90 |
| First Contentful Paint | 4.5s | ≤ 3.0s | ≤ 1.8s |
| Largest Contentful Paint | 9.8s | ≤ 4.0s | ≤ 2.5s |
| Speed Index | 4.5s | ≤ 3.5s | ≤ 3.4s |
| TTI | 9.8s | ≤ 5.0s | ≤ 3.8s |
| Bundle inicial (script transfer) | ~700KB gzipped | ≤ 500KB | ≤ 300KB |

## Itens pra fechar antes do beta

### 🚨 Bloqueantes

#### 1. **Reset de dados Firestore** (regra alpha → beta)
Hoje o CLAUDE.md autoriza dropar torneios/venues/users livremente. Antes de beta:
- [ ] Notificar amigos-testers que o reset está vindo
- [ ] Limpar `tournaments`, `venues`, `presences`, `casualMatches`, `mail` no console Firebase
- [ ] Manter `users` (perfis vão sobreviver a primeira leva de usuários reais)
- [ ] Documentar a partir daqui: "regra de não-quebrar-compat ativa"

#### 2. **Sentry DSN ativada**
- [ ] Criar projeto em sentry.io (free tier)
- [ ] Descomentar a linha em `index.html` (`<script>window.SENTRY_DSN = "..."</script>`)
- [ ] Validar primeiro erro chegando ao dashboard do Sentry
- [ ] Smoke-test ainda passando após ativação

#### 3. **Backup automatizado do Firestore**
Hoje não há nenhum backup configurado. Em beta com dados reais:
- [ ] Configurar Cloud Scheduler + Cloud Function que faz `gcloud firestore export` diariamente para um bucket Cloud Storage
- [ ] Retenção de 30 dias automática via lifecycle rule no bucket
- [ ] Documentar como fazer restore (1 página, runbook)
- [ ] Testar restore em ambiente isolado uma vez

#### 4. **Política de privacidade + Termos de uso visíveis**
Beta com usuários reais → LGPD aplicável.
- [ ] Página `#privacy` com política mínima (LGPD)
- [ ] Página `#terms` com termos de serviço alpha-com-disclaimer
- [ ] Footer ou modal pedindo aceite explícito (uma vez por usuário)
- [ ] Modelo de "como apagar minha conta" — já existe (auth.js: excluir conta)

#### 5. **Quotas + alertas Firebase**
- [ ] Alertas via Firebase Alerts em: spike de leituras (>10x baseline), spike de writes (>5x), spike de erros 5xx
- [ ] Budget alert no Cloud Billing em $20, $50, $100 (hard cap pra alpha → beta)
- [ ] Documentar plano de ação se um alarme dispara (1 página)

### 🟡 Importantes

#### 6. **Performance: LCP < 4s**
LCP em 9.8s é o bottleneck principal. Opções (escolher 1):
- **Skeleton inline no HTML** estático — `<div class="hero-skeleton">` que vira o LCP element até o JS substituir. Estimativa: LCP < 4s. Esforço: ~3h.
- **Static prerender da landing** via GitHub Action que roda Puppeteer e gera HTML pré-renderizado. Estimativa: LCP < 2.5s. Esforço: ~1 dia.

#### 7. **Reduzir bundle inicial em -100KB**
- **Lazy i18n EN** — só carregar o dict da lang ativa. Saves ~30KB gzipped pra users PT (maioria). **Cuidado:** mudança em load order de scripts, requer revisão. Estimativa: -100ms FCP.
- **Lazy Firebase init** — instanciar SDK só no primeiro uso (login, save). **Cuidado:** auth flow é ramo crítico. Estimativa: -1s FCP/LCP.

#### 8. **Cobertura E2E expandida**
Hoje 3 cenários (smoke/help/PWA). Pra beta:
- [ ] Login fake-mode (Firebase Auth emulator ou Playwright fixture)
- [ ] Criar torneio + verificar persistência via API
- [ ] Inscrever-se via convite + verificar dashboard
- [ ] Lançar placar de partida casual entre 2 tabs sincronizadas
- [ ] Apagar tudo (cleanup) — fixture per-test com cleanup hook

Meta: **≥10 cenários, runs em <60s, CI green**.

#### 9. **Acessibilidade ≥ 95**
Hoje em 88 (WCAG AA falta em alguns lugares). Auditar com `@axe-core/playwright`:
- [ ] Contrast ratio em todos os 4 temas (especialmente Sunset light)
- [ ] Form labels associados via `<label for>` ou `aria-label`
- [ ] Skip-nav já existe — verificar se foca corretamente
- [ ] Modal focus trap testado em todos os modais
- [ ] Hamburger menu navegável por teclado

#### 10. **Logger centralizado** (pré-Sentry roteamento)
Os 200+ `console.log/warn/error` espalhados precisam virar `window._log/_warn/_error`:
- [ ] Wrapper em `js/logger.js` (15min)
- [ ] Modo prod: silencia `_log`, mantém `_warn/_error` + envia pra Sentry breadcrumbs
- [ ] Modo dev (localhost): tudo no console como antes
- [ ] Refactor por arquivo — cuidado, é mecânico mas extensivo

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

## Roadmap proposto até beta

### Sprint 2 (próxima — 1 semana)
- 🟡 #6: LCP skeleton (3h)
- 🟡 #7: Lazy i18n EN (com revisão) (45min + revisão)
- 🟡 #8: +5 cenários E2E (4h)
- 🟢 #10: Logger centralizado (4h)

### Sprint 3
- 🚨 #3: Backup automatizado Firestore (1 dia)
- 🚨 #4: Política privacy + termos (4h + revisão jurídica)
- 🟡 #9: Acessibilidade ≥ 95 (1 dia)
- 🟡 #7: Lazy Firebase init (com revisão) (4h + revisão)

### Sprint 4 (entrega beta)
- 🚨 #1: Reset Firestore + comunicar testers (1h)
- 🚨 #2: Plugar Sentry DSN (15min + verificação)
- 🚨 #5: Quotas + alertas Firebase (2h)
- 🟢 polishing residual

**Total estimado:** ~3-4 semanas de trabalho focado.

---

## Critério de saída pra beta

Tudo abaixo precisa estar verde:

- [ ] **Performance Lighthouse ≥ 75** em mobile slow-4G
- [ ] **Acessibilidade Lighthouse ≥ 95**
- [ ] **0 erros JS no console** após smoke completo (login + criar + jogar + sair)
- [ ] **Sentry recebendo eventos reais** + 0 issues `unresolved` nas últimas 24h
- [ ] **E2E suite ≥ 10 cenários, 100% green em CI**
- [ ] **Backup Firestore** rodou nas últimas 24h, restore testado em isolado
- [ ] **Política privacy + termos** publicados e linkados no footer
- [ ] **Reset de dados** comunicado e executado
- [ ] **Quotas Firebase** sem nenhum alarme nos últimos 7 dias

Quando tudo isto for `[x]`, a versão pode subir pra `1.0.0-beta`.
