# Lighthouse Baseline

**Data:** 2026-04-28
**Versão atual:** v0.17.58-alpha (após defer em massa)
**URL:** https://scoreplace.app/
**Condições:** mobile, Slow 4G simulado, headless Chrome incognito

---

## Histórico de runs

| Versão | Mudança | Performance | A11y | FCP | LCP | SI |
|---|---|---:|---:|---:|---:|---:|
| v0.17.55 (baseline) | — | 56 | 88 | 9.2s | 10.0s | 9.2s |
| v0.17.56 | lazy release notes | 56 | 88 | 9.0s | 9.5s | 9.0s |
| v0.17.57 | tira release-notes do precache do SW | 57 | 88 | 8.8s | 9.4s | 8.8s |
| **v0.17.58** | **defer em 45 scripts** | **64** | 88 | **4.5s ↓49%** | 9.8s | **4.5s** |
| v0.17.62 | skeleton estático | 63 | 88 | 4.7s | 9.8s | 4.7s |
| v0.17.63 | a11y heading-order + selects | 63 | 93 | — | — | — |
| v0.17.64 | a11y _toggleSwitch helper | 63 | 93 | — | — | — |
| v0.17.65 | a11y batch 20 aria-label | 63 | 96 | — | — | — |
| **v0.17.66** | **a11y color-contrast** | **65** | **100** 🎯 | — | — | — |
| v0.17.68 | lazy i18n EN (-30KB gzipped) | 64 (média) | 100 | 4.5s | 9.5s | 4.5s |
| v0.17.69 | static prerender da landing | 64 (média 3 runs) | 100 | 4.5s | 9.4s | 4.5s |
| v0.17.71 | privacy/terms + backup scaffolding + i18n hotfix | 64 | **100 ✓** | 4.5s | 9.4s | 4.5s |

### v0.17.71 confirmado (2026-04-29)

Lighthouse pós-deploy v0.17.71:
- Performance: 64 (estável)
- **Accessibility: 100** 🎯 (zero failed audits — beta target ≥95 atingido com folga)
- Best Practices: 96
- SEO: 100

A11y atingiu o máximo. Gargalos remanescentes pra performance estão
listados em `docs/beta-readiness.md` §6 — único caminho real é Firebase
init lazy (em DEFER por alto risco em auth flow).

### v0.17.69 — Static prerender (LCP **NÃO** moveu)

3 runs Lighthouse mobile slow-4G:
- run 1: perf=64 fcp=4.5s lcp=9.4s si=4.5s
- run 2: perf=65 fcp=4.3s lcp=9.3s si=4.3s
- run 3: perf=63 fcp=4.8s lcp=9.5s si=4.8s
- **média: perf=64 fcp=4.5s lcp=9.4s si=4.5s**

Esperava-se LCP cair de ~9.5s pra ≤4s. **Não aconteceu.** Investigação:

- LCP element identificado: `<img src="icons/logo-podium.svg" w=96 h=72>`
- Logo loada em **580ms** (request started 207ms, ended 577ms)
- LCP timing reportado: **9440ms**
- Gap: **8.8 segundos** entre image-loaded e LCP-fired

**Hipótese:** Lighthouse mede LCP como "largest contentful paint *estável*",
não primeiro paint. Layout shifts decorrentes de JS hidratando topbar +
auth init + outros 40+ scripts deferidos resetam o LCP candidate. A
"estabilidade" só ocorre após todos os defers + hydration completar — daí
o gap.

**Conclusão:** o gargalo real do LCP nessa arquitetura SPA vanilla é a
quantidade de scripts deferidos (40+) que precisam executar antes do
layout estabilizar. Static prerender melhora **percepção visual** (real
users em 4G real veem o landing imediato), mas não move o número
sintético do Lighthouse.

**O que moveria LCP de verdade nesta arquitetura:**
1. Firebase init lazy — Firebase compat SDKs (4 scripts, ~150KB) são o
   maior bloco de execução pós-defer. Ainda em [DEFER] por risco em
   auth flow.
2. Critical CSS inlined + rest async — corta CSS render-blocking
3. Route-based code splitting — deixa de carregar 40 scripts no boot

Decisão: **manter o prerender deployado**. Custo é desprezível (~7KB),
ganho percebido é real, e a infra (script + template workflow) fica
pronta pra uso futuro.

### v0.17.68 — Lazy i18n EN

Mudança: `i18n-en.js` (107KB raw / ~30KB gzipped) só carrega quando user está
em EN ou toggle pra EN. PT (default + maioria) economiza esse peso no boot.

**2 runs do Lighthouse mobile slow-4G:**
- run 1: perf=65 fcp=4.2s lcp=9.4s si=4.2s
- run 2: perf=63 fcp=4.8s lcp=9.6s si=4.8s
- **média: perf=64 fcp=4.5s lcp=9.5s si=4.5s**

**Vs baseline (v0.17.62-66):** dentro do ruído. Lighthouse mobile slow-4G
tem variance de ±10% em FCP/SI por run. Bundle delta de 30KB gzipped não
move significativamente as métricas synthetic.

**Mas em real-world** (4G real, não simulado), 30KB = 1-2 round trips de TCP
slow-start menos. Mensurável quando tivermos RUM (real user monitoring) via
Sentry pós-beta.

**Validação manual antes do deploy:**
- Local server (python3 -m http.server)
- PT user: só `i18n-pt.js` carregado, EN dict ausente, `_t` retorna PT
- Toggle PT→EN via `_setLang('en')`: dynamic load funciona, ambos dicts disponíveis

### v0.17.62 (skeleton) — conclusão da medição

3 runs do Lighthouse mobile slow-4G (v0.17.62):
- run 1: perf=62 fcp=5.1s lcp=9.9s si=5.1s
- run 2: perf=64 fcp=4.3s lcp=9.7s si=4.3s
- run 3: perf=63 fcp=4.8s lcp=9.7s si=4.8s
- **média: perf=63 fcp=4.7s lcp=9.8s si=4.7s**

Comparado a v0.17.58 (perf=64 fcp=4.5s lcp=9.8s si=4.5s), o skeleton ficou
**neutro em métricas** (variance dentro do ruído de ±0.5s da slow-4G simulada).

**Por que LCP não caiu?** Lighthouse elege como LCP o conteúdo *real* que
renderiza depois — texto/imagem da landing page, não o skeleton. O skeleton
está marcado `aria-hidden=true` e tem dimensões padrão; LCP ignora.

**Por que mantenho então?** UX-positivo: usuários veem visual feedback no
FCP em vez de tela branca + spinner. Lighthouse mede pixels; UX percebida
é diferente. Custo é ~600 bytes (~150 gzipped). Sem regressão real.

**Próximas alavancas pra LCP <4s** (real, não cosmético):
- Static prerender da landing via GitHub Action + Puppeteer (gera HTML
  pré-renderizado da rota `/` com conteúdo real). Estimativa: LCP < 2.5s.
  Esforço: ~1 dia. Esta É a próxima mudança real pra LCP.

## Scores atuais (v0.17.58)

| Categoria | Score | Threshold |
|---|---:|---:|
| Performance | **64** | ≥ 90 ideal |
| Accessibility | 88 | ≥ 95 ideal |
| Best Practices | 96 | ≥ 95 ✓ |
| SEO | 100 | ≥ 95 ✓ |

## Core Web Vitals (mobile)

| Métrica | Valor | Threshold "good" |
|---|---:|---:|
| First Contentful Paint (FCP) | **4.5 s** | ≤ 1.8 s |
| Largest Contentful Paint (LCP) | 9.8 s | ≤ 2.5 s |
| Total Blocking Time (TBT) | 0 ms | ≤ 200 ms |
| Cumulative Layout Shift (CLS) | 0 | ≤ 0.1 |
| Speed Index | **4.5 s** | ≤ 3.4 s |
| Time to Interactive (TTI) | 9.8 s | ≤ 3.8 s |

## Resource breakdown (transfer / gzipped)

| Tipo | Requests | Transfer KB |
|---|---:|---:|
| Total | 151 | 1,292 |
| Script | 98 | 1,091 |
| Third-party | 46 | 429 |
| Font | 4 | 79 |
| Image | 22 | 60 |
| Other | 10 | 33 |
| Stylesheet | 12 | 23 |
| Document | 5 | 6 |

---

## Caveat metodológico do baseline

A primeira run de Lighthouse (rotulada `baseline-v0.17.55-mobile`) aconteceu durante o rollout do deploy v0.17.56 no GitHub Pages — Chrome já carregou o `main.js` reduzido (152 KB) e não o original de 1.16 MB. Os números "before" e "after" no comparativo direto são quase idênticos por isso, **não porque o lazy-load não funcionou**.

Evidência de que o lazy-load funciona (verificada por curl + audit de network do Lighthouse):
- `main.js` em produção: **152 KB raw / 40 KB gzipped** (era 1,160 KB raw / ~250 KB gzipped).
- `release-notes.js` **não é fetchado** no first paint nem aparece nos `network-requests` do Lighthouse — só carrega ao abrir o modal de Help.

## Por que FCP/LCP não despencaram

O ganho de bytes (-210 KB gzipped no first paint) é real mas **não é o gargalo do FCP**. main.js carrega no fim do bloco de `<script>` do `index.html` — não bloqueia o paint inicial. Os blockers efetivos são:

1. **Bloco inicial de scripts no head**: theme.js, i18n.js, i18n-pt.js, i18n-en.js, store.js, firebase-db.js, presence-db.js, etc. — ~14 scripts antes do CSS, ~120 KB gzipped.
2. **Firebase SDK init** (third-party 429 KB) — bloqueia o JS engine na inicialização.
3. **42 scripts em série sem `defer`/`async`** — cada um espera o anterior parsear.

## Próximas alavancas (priorizadas por ROI)

### ✅ Feito — Defer em massa (v0.17.58)
**Resultado:** FCP 8.8s → 4.5s (-49%). Score Performance 57 → 64.

### 🥇 Prioridade 1 — Reduzir LCP (atualmente 9.8s)
LCP é dominado pelo conteúdo principal acima-da-dobra. Hoje está em 9.8s pq depende do JS rodar pra renderizar a dashboard (login screen + cards). Opções:
- **Inline critical CSS + skeleton LCP element** no HTML estático (`<div class="hero-skeleton">...`) que vira o LCP element até o JS substituir. Estimativa: LCP < 4s.
- **SSR/static prerender da landing** (página `/` sem hash) — primeiro paint vira HTML puro. Estimativa: LCP < 2.5s. Esforço alto (Workflow GitHub Action + script gera HTML estático).

### 🥈 Prioridade 2 — Lazy-load de i18n-en.js
Como em `bundle-audit.md` Win #2. Saves 107 KB raw (~30 KB gzipped) para users PT. **Estimativa: -100 a -300ms FCP**, esforço de ~45 minutos.

### 🥉 Prioridade 3 — Lazy-load de Firebase
Carregar Firebase SDK + initialize só no primeiro flow que precisa (login, save). Hoje carrega no boot. **Estimativa: -1 a -2s no FCP/LCP**, esforço alto (~4h, requer entender quais módulos precisam quando).

### 4 — Reduzir TBT/TTI
TBT está em 0ms (ótimo) mas TTI em 9.8s. TTI requer 5s sem long-tasks após FCP — provavelmente o init do Firebase + a hidratação da dashboard cria janela ocupada. Splittar inicialização em múltiplos `requestIdleCallback`.

### 5 — Route-based code splitting (Bundle Audit Finding #3)
Não carregar `bracket-ui.js`, `create-tournament.js`, `venues.js` no boot. Esforço alto (~1 sprint). Defer pra Sprint 3.

---

## Reproduzir

```bash
cd docs/lighthouse
export CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
npx --yes lighthouse@12 https://scoreplace.app/ \
  --quiet \
  --chrome-flags="--headless=new --no-sandbox --incognito" \
  --output=json --output=html \
  --output-path=./run-$(date +%Y%m%d-%H%M)-mobile \
  --form-factor=mobile --screenEmulation.mobile=true \
  --only-categories=performance,accessibility,best-practices,seo
```

⚠️ Há um `LanternError: rootNode not found` benigno no fim de cada run com lighthouse@12 — relatórios são gerados normalmente apesar do erro. Não afeta os números.

## Arquivos neste diretório

- `baseline-v0.17.55-mobile.report.{json,html}` — primeira run (já com v0.17.56 servindo, ver caveat).
- `after-v0.17.56-mobile.report.{json,html}` — segunda run (mesma versão deployed).
- `after-v0.17.57-mobile.report.{json,html}` — pós-fix do SW precache.

Próximos targets para tracking: FCP < 5s, Performance score > 70.
