# scoreplace.app — Evolution API (WhatsApp gateway)

Self-hosted Evolution API rodando no Railway, parado a um número
dedicado (eSIM Vivo Pré). Cloud Function `processWhatsAppQueue`
consome `whatsapp_queue` no Firestore e POSTa pra esse endpoint.

**Custo total:** ~R$20/mês (eSIM Vivo) + R$0-5/mês (Railway free tier).

## Setup completo (~1h spread em 2-3 sessões)

### 1. Ativar eSIM Vivo Pré (você, ~10min)

- Abre o **app Vivo** OU [vivo.com.br/esim](https://www.vivo.com.br/esim)
- Escolhe **Vivo Easy Pré** (ou outro plano pré com SMS)
- Plano mais barato: ~R$20/mês (recarga mínima)
- Ativa o eSIM no seu iPhone/Android (vai como "linha 2")
- **Anota o número** (ex.: `+55 11 91234-5678`)
- Recebe SMS de confirmação no eSIM → eSIM ativo ✅

### 2. Instalar WhatsApp Business no número novo (você, ~5min)

- Baixa **WhatsApp Business** (não o WhatsApp comum) na App/Play Store
- Abre, escolhe a **linha eSIM** (ou desinstala WhatsApp comum primeiro)
- Recebe SMS de verificação → confirma o código
- Configura nome do perfil: `scoreplace.app`
- Configura foto do perfil (logo do scoreplace) e descrição
- Pronto: WhatsApp Business ativo no eSIM ✅

### 3. Criar conta Railway (você, ~3min)

- Abre [railway.app](https://railway.app) → Sign in com GitHub
- Plano gratuito: $5 grátis/mês (~500h de container — sobra pra
  Evolution API rodar 24/7 mês inteiro)

### 4. Deploy Evolution API no Railway (eu, automático)

```bash
# (rodo no seu terminal local, autenticado no railway-cli)
cd infra/whatsapp
railway login                           # abre browser pra auth
railway init                            # cria novo projeto
railway add postgresql                  # postgres add-on
railway up                              # build + deploy do Dockerfile
railway domain                          # gera URL pública (subdomain railway.app)
```

Configurar env vars no Railway Dashboard (copiar de `.env.example`):
- `AUTHENTICATION_API_KEY` — gerar via `openssl rand -hex 32`
- `SERVER_URL` — URL pública do Railway
- (resto já tem default ok ou referencia `${DATABASE_URL}` injetado)

### 5. Parear instância com QR Code (você, ~3min)

- Abre `https://<sua-railway-url>/manager`
- Login com a `AUTHENTICATION_API_KEY` (criada acima)
- "Create instance" → nome: `scoreplace`
- Aparece o QR Code
- No iPhone/Android, abre **WhatsApp Business** → ⋮ → **Aparelhos
  conectados** → "Conectar um aparelho" → escaneia o QR
- Pronto: instância pareada ✅ (Evolution mantém a sessão; o app
  pode ficar fechado).

### 6. Configurar Firebase secrets (você, ~2min)

```bash
firebase functions:secrets:set EVOLUTION_API_URL
# cola: https://<sua-railway-url>

firebase functions:secrets:set EVOLUTION_API_KEY
# cola: <AUTHENTICATION_API_KEY>

firebase functions:secrets:set EVOLUTION_INSTANCE
# cola: scoreplace
```

### 7. Deploy Cloud Function (eu, automático)

```bash
cd functions
firebase deploy --only functions:processWhatsAppQueue
```

### 8. Testar end-to-end (juntos, ~2min)

1. No scoreplace, vai em `#profile` → ativa toggle "Receber por WhatsApp"
2. Salva
3. Em qualquer torneio que você esteja inscrito, dispara um evento
   (ex.: outro user se inscreve no mesmo torneio)
4. Em ~5s o WhatsApp Business no eSIM vibra com a notificação ✅

## Comandos úteis

```bash
# Ver logs do Evolution API em tempo real
railway logs

# Restart (se precisar limpar sessão WhatsApp e re-parear)
railway restart

# Ver status da instância via API
curl -H "apikey: $EVOLUTION_API_KEY" \
  "$EVOLUTION_API_URL/instance/connectionState/scoreplace"

# Enviar msg de teste manual
curl -X POST "$EVOLUTION_API_URL/message/sendText/scoreplace" \
  -H "apikey: $EVOLUTION_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"number":"5511999998888","text":"Teste do scoreplace ✅"}'
```

## Operação contínua

| O que | Frequência | Ação |
|---|---|---|
| WhatsApp re-pareamento | A cada ~14 dias OU se app parar de enviar | Reabrir `/manager`, scan QR |
| Verificar saúde do servidor | Mensal | `railway status`, ver logs Sentry |
| Atualizar Evolution API | Trimestral (security) | bump tag em Dockerfile + `railway up` |
| Upgrade plano Railway | Quando free tier estourar | $5/mês cobre uso casual |

## Limites do plano free Railway

- **$5 de crédito/mês** (resetam dia 1)
- ~500h de container small (~700MB RAM, 1 vCPU compartilhado) — Evolution
  API consome ~150-300MB RAM em idle, ok pro free
- Quando estourar: alerta por email; pra manter operação 24/7 + crescimento,
  upgrade pro Hobby Plan ($5/mês fixo) ou Pro ($20/mês).

## Riscos & mitigações

| Risco | Probabilidade | Mitigação |
|---|---|---|
| WhatsApp banir o número (uso atípico) | Baixa pra notificações transacionais opt-in | Não enviar pra quem não opt-in; sempre incluir nome do remetente; respeitar opt-out |
| Sessão WhatsApp Web cair | Média (a cada 1-3 semanas) | Re-pareamento via QR Code (3min); alerta por email se Cloud Function detectar `instance state != open` por > 30min |
| Railway free tier estourar | Baixa pra volume scoreplace | Migrar pra $5 Hobby OU pra Hetzner R$24 |
| Evolution API CVE / bug | Baixa | Bump versão em Dockerfile + redeploy quando release oficial sair |

## Fallback se tudo der errado

Toggle `notifyWhatsApp` no perfil já é independente do canal. Se a infra
quebrar, o app continua mandando notificação **platform** (Firestore
inbox) e **email** — usuário não fica sem ser avisado, só perde o canal
WhatsApp temporariamente.
