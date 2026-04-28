# Observability — Sentry boilerplate

**Status:** boilerplate plugado, **DSN não configurado** (silent no-op).
**Arquivo:** `js/sentry-init.js`
**Carregamento:** sync no `<head>`, antes de qualquer outro script — captura
erros em qualquer ponto do boot, inclusive em scripts deferidos.

---

## Como ativar (produção)

1. Crie projeto em https://sentry.io (free tier serve pra começar).
2. Copie o DSN público (formato `https://abc123@o000.ingest.sentry.io/000`).
3. No `index.html`, descomente esta linha (logo antes de `sentry-init.js`):
   ```html
   <script>window.SENTRY_DSN = "https://SEU_DSN_AQUI";</script>
   ```
4. Bumpe versão + cache buster, deploy.

Sem DSN o app boota normal. Os helpers `_captureException`/`_captureMessage`
ficam expostos como no-op — callers podem usar sem checar disponibilidade.

## Como ativar em DEV (sem commitar DSN)

Numa aba qualquer do app:
```js
localStorage.setItem('scoreplace_sentry_dsn', 'https://SEU_DSN');
location.reload();
```

Pra desativar:
```js
localStorage.removeItem('scoreplace_sentry_dsn');
```

## Configuração padrão

| Setting | Valor | Justificativa |
|---|---|---|
| `release` | `scoreplace@<SCOREPLACE_VERSION>` | Agrupa errors por versão deployada |
| `environment` | `production` se hostname=`scoreplace.app`, `preview` caso contrário | Distingue prod de localhost/preview |
| `sampleRate` | `1.0` | Capturar 100% dos errors em alpha/beta — volume baixo |
| `tracesSampleRate` | `0.05` | 5% das transações pra perf budget — controla custo |
| `ignoreErrors` | Filtra `ResizeObserver`, `chrome-extension://`, etc. | Ruído conhecido do ecossistema |
| `beforeSend` | Anonimiza email/displayName, adiciona tag `route` | Privacy + agrupa por área |

## Pré-init buffer

Errors entre o boot do app e o load do SDK CDN (~100ms-1s) são bufferizados.
`window.onerror` e `window.onunhandledrejection` empilham eventos num array
local; quando o SDK termina de carregar, o array é drenado pra Sentry.

Importante: **as funções helpers já no boot** (`_captureException`,
`_captureMessage`) **também usam o buffer** se chamadas antes do SDK estar
pronto.

## Como usar nos call sites

```js
try {
  doSomethingDangerous();
} catch (err) {
  // Silent fail pro user, mas captura pra Sentry
  window._captureException(err, { tournament: t.id, action: 'save' });
  showNotification('⚠️ Algo deu errado', 'Tente novamente', 'error');
}

// Custom message (ex: estado inesperado)
if (foundStaleData) {
  window._captureMessage('Stale data on tournament load', 'warning');
}
```

Não envolver TODO try/catch — só callsites onde o usuário enxerga erro
genérico (ex: "tente novamente") e a equipe precisa diagnosticar.

## Privacy

`beforeSend` deleta:
- `event.user.email`
- `event.user.username`

E o DSN público (não o secret) tem acesso só de write. Sem leak de PII.

Nunca enviar pra Sentry: senhas, tokens, mensagens privadas, dados de torneio
de usuários reais. Já filtra automaticamente — se precisar adicionar mais
campos sensíveis, estender o `beforeSend` em `js/sentry-init.js`.

## Custos

Sentry free tier: 5K errors/mês + 10K transactions/mês. Suficiente pra alpha
e início de beta. Se o volume estourar, desativar `tracesSampleRate` (vai
pra zero) ou pegar paid plan.

## Próximos passos (não-bloqueantes pra beta)

- [ ] Plugar DSN real quando usuários reais começarem a testar (beta).
- [ ] Adicionar Sentry Releases via GitHub Action no deploy (`sentry-cli releases`).
- [ ] Source maps upload se algum dia vier minificação/build step.
- [ ] Migrar console.log/warn/error pra wrapper centralizado (`window._log`)
  que roteia pra Sentry breadcrumbs em produção. Hoje 81 console.log em
  auth.js, 40 em firebase-db.js etc. — ver `code-debt-audit.md`.
