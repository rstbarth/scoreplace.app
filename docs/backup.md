# Firestore Backup & Restore

**Status:** boilerplate plugado em `functions/index.js`, **não-deployado** ainda.
Pré-requisitos de infra (bucket + IAM) precisam ser configurados antes de rodar.

**Função:** `backupFirestore` — daily 04:00 BRT scheduled job que exporta
todo o Firestore pra um bucket Cloud Storage. Bucket tem lifecycle rule
auto-deletando exports após 30 dias.

---

## 1. Setup (one-time, antes do primeiro deploy da função)

Roda comandos `gcloud` no terminal do dono do projeto.

### 1.1. Criar bucket dedicado

```bash
gcloud storage buckets create gs://scoreplace-firestore-backup \
  --project=scoreplace-app \
  --location=us-central1 \
  --uniform-bucket-level-access
```

⚠️ **Region matters:** o Firestore desse projeto está em **`nam5` (multi-region US)**.
Firestore export exige bucket numa region COMPATÍVEL com a database. Pra `nam5`,
opções válidas são `us` (multi) ou `us-centralN`. Escolhemos `us-central1`
porque é region única (mais barato que multi) e idempotent ao Firestore.

Tentar `southamerica-east1` (mais próximo do tráfego BR) **falha** com
`INVALID_ARGUMENT: Bucket ... is in location southamerica-east1. This database
can only operate on buckets spanning location us or us-central1...`. Aprendido
em deploy 2026-04-29.

### 1.2. Lifecycle: auto-delete após 30 dias

```bash
cat > /tmp/lifecycle.json << 'EOF'
{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "Delete"},
        "condition": {"age": 30}
      }
    ]
  }
}
EOF

gcloud storage buckets update gs://scoreplace-firestore-backup \
  --lifecycle-file=/tmp/lifecycle.json
```

### 1.3. IAM — service account das Functions

A function roda com a service account default das Cloud Functions
(`<PROJECT_NUMBER>-compute@developer.gserviceaccount.com`). Precisa
de duas roles:

- `roles/datastore.importExportAdmin` (no projeto, pra disparar exports)
- `roles/storage.admin` (no bucket, pra escrever)

```bash
SA="$(gcloud projects describe scoreplace-app --format='value(projectNumber)')-compute@developer.gserviceaccount.com"
echo "Service account: $SA"

# Role 1: dispara exports
gcloud projects add-iam-policy-binding scoreplace-app \
  --member="serviceAccount:$SA" \
  --role="roles/datastore.importExportAdmin"

# Role 2: escreve no bucket
gcloud storage buckets add-iam-policy-binding \
  gs://scoreplace-firestore-backup \
  --member="serviceAccount:$SA" \
  --role="roles/storage.admin"
```

### 1.4. Deploy só dessa função

```bash
firebase deploy --only functions:backupFirestore
```

⚠️ **NUNCA** `firebase deploy --only functions` sem nome — vai redeployar
funções que vivem em outro source (autoDraw, stripeWebhook, etc.) e pode
sobrescrever versões em produção. Sempre alvejar nome específico.

### 1.5. Validar primeiro run

Se você não quer esperar até 04:00 BRT, dispare manualmente via Cloud
Console > Cloud Scheduler > `firebase-schedule-backupFirestore-southamerica-east1`
> botão "Run now". Em ~5min, o bucket deve ter uma subpasta nova
`<TIMESTAMP>/`.

Verificar:

```bash
gcloud storage ls gs://scoreplace-firestore-backup/
# Deve listar pelo menos 1 pasta com formato 2026-04-29T04-00-00/

gcloud storage ls gs://scoreplace-firestore-backup/2026-04-29T04-00-00/
# Deve mostrar metadata + output-0, output-1, etc. (uma pasta por collection)
```

---

## 2. Restore (em caso de desastre)

⚠️ **DESTRUTIVO** — import substitui dados existentes que tenham mesmo path.
Faça em ambiente isolado primeiro pra validar antes de aplicar em produção.

### 2.1. Restore completo (todas as collections)

```bash
# Listar exports disponíveis pra escolher data:
gcloud storage ls gs://scoreplace-firestore-backup/

# Restore (substitui!):
gcloud firestore import gs://scoreplace-firestore-backup/2026-04-29T04-00-00 \
  --project=scoreplace-app
```

### 2.2. Restore parcial (1 collection)

```bash
gcloud firestore import gs://scoreplace-firestore-backup/2026-04-29T04-00-00 \
  --collection-ids=tournaments \
  --project=scoreplace-app
```

### 2.3. Validar pós-restore

Spot-check via Firebase Console > Firestore Data:
- Documento que você sabia existir, exists?
- Contagem de docs por collection bate com a expectativa?
- Smoke test do app: `npm run test:e2e` ainda verde?

---

## 3. Custos esperados

- **Storage**: ~$0.023/GB/mês na região southamerica-east1. Alpha atual
  tem ~10MB de dados → < $0.01/mês. Em beta com 1000 users ativos,
  estimativa de 1GB → ~$0.02/mês. Lifecycle 30d previne crescimento
  indefinido.
- **Operations**: 1 export/dia. Cada export é cobrado por documento
  exportado. 10K docs = $0.01. Beta com 100K docs = $0.10/dia = $3/mês.
- **Function execution**: trivial. Disparar export é 1 chamada de API.
  Função encerra em ~5s. Free tier cobre.

**Total estimado em beta (1000 users):** ~$5-10/mês.

---

## 4. Monitoramento

Configurar alertas em Firebase Alerts (Console > Functions > Alerts):

- **Falha do scheduled run** — alerta se `backupFirestore` retornar erro
- **Bucket size > X** — sinal de que lifecycle não está limpando

Verificação manual semanal recomendada:

```bash
# Quantas pastas de backup existem?
gcloud storage ls gs://scoreplace-firestore-backup/ | wc -l
# Esperado: ~30 (uma por dia, com lifecycle 30d ativo)
```

---

## 5. Troubleshooting

### Erro `permission denied` ao disparar export
Service account não tem `datastore.importExportAdmin`. Re-rodar passo 1.3.

### Erro `bucket not found`
Bucket nome errado em `functions/index.js` (variável `bucketName`) ou
bucket foi deletado. Recriar e ajustar o nome no código.

### Export demora muito (>10 min)
Normal pra dataset grande. A function só DISPARA o export — não espera
ele terminar. Acompanhar progresso em Cloud Console > Firestore > Import/Export.

### Lifecycle não está deletando
Confirmar config:
```bash
gcloud storage buckets describe gs://scoreplace-firestore-backup \
  --format="value(lifecycle)"
```
Lifecycle só roda 1x por dia, então pode levar 24h pra ver efeito após
configurar.

---

## 6. Próximos passos (não-bloqueantes pra beta)

- [ ] Adicionar GitHub Action que valida que backup mais recente é < 36h
  (alarme se backup pulou um dia)
- [ ] Restore drill mensal — script automatizado que importa o backup
  mais recente num projeto Firebase isolado e roda smoke tests
- [ ] Backup geo-replicado (multi-region bucket) pra disaster recovery
  ainda mais robusto. Custo dobra.
