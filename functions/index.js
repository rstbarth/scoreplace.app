/**
 * scoreplace.app — Cloud Functions (local source)
 *
 * NOTE: This file intentionally contains ONLY the cleanup functions deployed
 * from this workspace. Other production functions (autoDraw, stripeWebhook,
 * sendPushNotification, createCheckoutSession, ext-firestore-send-email-*)
 * live in Firebase production and were deployed from a different source.
 * They are NOT touched by deploys from here — always use
 * `firebase deploy --only functions:NAME` to target specific functions.
 *
 * The WhatsApp queue function (processWhatsAppQueue) is preserved in
 * index.js.with-whatsapp.backup for when the WHATSAPP_TOKEN /
 * WHATSAPP_PHONE_ID secrets are configured and the integration is ready
 * to deploy.
 *
 * Scheduled jobs currently deployed from here:
 *
 * 1) cleanupOldNotifications: daily at 03:00 BRT, deletes read notifications
 *    older than 90 days across all users via a collection-group query.
 *
 * 2) cleanupOldCasualMatches: daily at 03:30 BRT, deletes finished
 *    casualMatches older than 30 days. Per-player stats persist separately
 *    on user profiles so the room doc is disposable.
 */

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const fetch = require("node-fetch");

admin.initializeApp();

// ─── Helper: batched delete of a query, page by page ─────────────────────────
// Firestore caps batch writes at 500 docs. We pull pages of up to 400 and
// commit each as a batch until the query returns empty. Keeps memory bounded
// and avoids ballooning the function's runtime on large cleanups.
async function _batchDeleteQuery(query, pageSize) {
  pageSize = pageSize || 400;
  const db = admin.firestore();
  let deleted = 0;
  // Guard against runaway loops in case the query keeps matching forever.
  for (let pass = 0; pass < 100; pass++) {
    const snap = await query.limit(pageSize).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    deleted += snap.size;
    if (snap.size < pageSize) break;
  }
  return deleted;
}

// ─── Scheduled cleanup: old notifications ────────────────────────────────────
// Deletes notifications that are already read AND older than 90 days, across
// every user's subcollection. Uses a collection-group query, so the first
// run may need a Firestore composite index on the `notifications` collection
// group — Firebase logs an auto-generated console link if missing. The
// window is intentionally generous: users who leave the app dormant for a
// few months keep their unread history; only stale read ones go.
exports.cleanupOldNotifications = onSchedule(
  {
    schedule: "every day 03:00",
    timeZone: "America/Sao_Paulo",
    region: "us-central1",
  },
  async () => {
    const db = admin.firestore();
    const threshold = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const query = db.collectionGroup("notifications")
      .where("read", "==", true)
      .where("createdAt", "<", threshold);
    const deleted = await _batchDeleteQuery(query);
    console.log(`[cleanupOldNotifications] deleted ${deleted} docs (threshold: ${threshold})`);
  }
);

// ─── Scheduled cleanup: old casual matches ───────────────────────────────────
// Finished casual match docs live in the top-level `casualMatches` collection.
// Each has `status: 'finished'` and `finishedAt` (ISO string) set the moment
// the match wraps up. Detailed per-player stats are persisted separately on
// each user's profile (see _buildAndPersistMatchRecord), so the room doc
// itself is disposable after 30 days. Keeps the collection bounded so the
// per-user `playerUids` array-contains query in getCasualMatchHistory stays
// cheap as the app grows.
exports.cleanupOldCasualMatches = onSchedule(
  {
    schedule: "every day 03:30",
    timeZone: "America/Sao_Paulo",
    region: "us-central1",
  },
  async () => {
    const db = admin.firestore();
    const threshold = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const query = db.collection("casualMatches")
      .where("status", "==", "finished")
      .where("finishedAt", "<", threshold);
    const deleted = await _batchDeleteQuery(query);
    console.log(`[cleanupOldCasualMatches] deleted ${deleted} docs (threshold: ${threshold})`);
  }
);

// ─── Scheduled cleanup: abandoned Firebase Auth accounts + merged ghosts ─────
//
// Dois tipos de lixo limpos aqui:
//
// TIPO 1 — "Incompletos": contas Auth sem doc Firestore (iniciaram login mas
// nunca completaram o perfil). Regra: criada + último login ambos > 30 dias.
// Por que 30 dias? Alguém pode receber convite de torneio, iniciar o flow e
// demorar semanas pra voltar. 30 dias = definitivamente abandonado.
//
// TIPO 2 — "Ghosts": contas cuja duplicata foi mergeada em outra conta. O doc
// Firestore fica com `mergedInto: <uid_canonico>` como tombstone. Após 7 dias
// do merge o ghost é apagado de Auth E Firestore — sem fantasmas no sistema.
// Por que 7 dias? É tempo suficiente pra qualquer sessão ativa do ghost expirar
// naturalmente. Firebase tokens duram 1h; refresh tokens duram mais, mas após
// o merge a conta não tem mais dados úteis.
//
// Implementação segura:
// - Pagina via listUsers() (1000 por vez)
// - Checa Firestore em lotes de 50
// - Contas com perfil real nunca são tocadas
exports.cleanupAbandonedAuth = onSchedule(
  {
    schedule: "every day 04:15",
    timeZone: "America/Sao_Paulo",
    region: "us-central1",
    timeoutSeconds: 300,
    memory: "256MiB",
  },
  async () => {
    const db = admin.firestore();
    const auth = admin.auth();
    const ABANDONED_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias
    const GHOST_THRESHOLD_MS     =  7 * 24 * 60 * 60 * 1000; //  7 dias
    const now = Date.now();
    let totalChecked = 0;
    let deletedAbandoned = 0;
    let deletedGhosts = 0;
    let pageToken = undefined;

    do {
      const listResult = await auth.listUsers(1000, pageToken);
      totalChecked += listResult.users.length;

      // Candidatos a incompletos (> 30 dias, sem login recente)
      const candidates = listResult.users.filter((u) => {
        const createdMs = u.metadata && u.metadata.creationTime
          ? new Date(u.metadata.creationTime).getTime() : 0;
        if (now - createdMs < ABANDONED_THRESHOLD_MS) return false;
        const lastSignInMs = u.metadata && u.metadata.lastSignInTime
          ? new Date(u.metadata.lastSignInTime).getTime() : 0;
        if (now - lastSignInMs < ABANDONED_THRESHOLD_MS) return false;
        return true;
      });

      // Todos os usuários (para detectar ghosts mesmo recentes)
      const allUsers = listResult.users;

      // ── TIPO 1: Incompletos sem Firestore doc ────────────────────────
      for (let i = 0; i < candidates.length; i += 50) {
        const batch = candidates.slice(i, i + 50);
        const refs = batch.map((u) => db.collection("users").doc(u.uid));
        const snaps = await db.getAll(...refs);
        for (let j = 0; j < batch.length; j++) {
          if (!snaps[j].exists) {
            try {
              await auth.deleteUser(batch[j].uid);
              deletedAbandoned++;
              console.log(`[cleanupAbandonedAuth] abandoned: uid=${batch[j].uid} email=${batch[j].email || batch[j].phoneNumber || "(anon)"}`);
            } catch (err) {
              console.warn(`[cleanupAbandonedAuth] failed abandoned uid=${batch[j].uid}:`, err.message);
            }
          }
        }
      }

      // ── TIPO 2: Ghosts com mergedInto ───────────────────────────────
      // Lê os docs Firestore de todos os usuários desta página em lotes de 50
      for (let i = 0; i < allUsers.length; i += 50) {
        const batch = allUsers.slice(i, i + 50);
        const refs = batch.map((u) => db.collection("users").doc(u.uid));
        const snaps = await db.getAll(...refs);
        for (let j = 0; j < batch.length; j++) {
          if (!snaps[j].exists) continue; // incompleto — já tratado acima
          const data = snaps[j].data() || {};
          if (!data.mergedInto) continue; // conta real — não tocar
          // É um ghost. Checar quando foi mergeado (campo createdAt ou updatedAt)
          const mergedAtStr = data.updatedAt || data.createdAt || "";
          const mergedMs = mergedAtStr ? new Date(mergedAtStr).getTime() : 0;
          if (mergedMs && (now - mergedMs) < GHOST_THRESHOLD_MS) continue; // recente, aguardar
          // Ghost velho o suficiente → apagar Auth + Firestore
          try {
            await auth.deleteUser(batch[j].uid);
          } catch (err) {
            if (err.code !== "auth/user-not-found") {
              console.warn(`[cleanupAbandonedAuth] failed ghost auth uid=${batch[j].uid}:`, err.message);
              continue;
            }
          }
          try {
            await snaps[j].ref.delete();
          } catch (err) {
            console.warn(`[cleanupAbandonedAuth] failed ghost fs uid=${batch[j].uid}:`, err.message);
          }
          deletedGhosts++;
          console.log(`[cleanupAbandonedAuth] ghost: uid=${batch[j].uid} mergedInto=${data.mergedInto}`);
        }
      }

      pageToken = listResult.pageToken;
    } while (pageToken);

    console.log(`[cleanupAbandonedAuth] checked=${totalChecked} abandoned=${deletedAbandoned} ghosts=${deletedGhosts}`);
  }
);

// ─── Scheduled cleanup: expired magic link wrappers ──────────────────────────
// v1.0.34-beta: docs em magicLinks/{token} guardam o firebaseLink resolvido
// pelo wrapper-URL no clique do email. Cada doc tem expiresAt = createdAt+90min
// (oobCode em si expira em 1h via Firebase). Sem cleanup, a coleção cresce
// 1 doc por magic link request. Roda 3x ao dia (04:30, 12:30, 20:30 BRT) pra
// manter a coleção pequena — cada execução remove docs com expiresAt < now.
exports.cleanupOldMagicLinks = onSchedule(
  {
    schedule: "every day 04:30",
    timeZone: "America/Sao_Paulo",
    region: "us-central1",
  },
  async () => {
    const db = admin.firestore();
    // expiresAt foi salvo como JS Date (Timestamp no Firestore). Comparação
    // direta com new Date() funciona via Timestamp.fromDate equivalência.
    const now = new Date();
    const query = db.collection("magicLinks").where("expiresAt", "<", now);
    const deleted = await _batchDeleteQuery(query);
    console.log(`[cleanupOldMagicLinks] deleted ${deleted} docs (threshold: ${now.toISOString()})`);
  }
);

// ─── Scheduled backup: full Firestore export to Cloud Storage ───────────────
// Roda diariamente às 04:00 BRT (depois dos cleanups) e dispara um export
// nativo do Firestore pra um bucket Cloud Storage. Bucket tem lifecycle rule
// que auto-deleta exports com mais de 30 dias.
//
// ⚠️ PRÉ-REQUISITOS pra ativar (one-time, fora do código):
//
// 1. Criar bucket dedicado pra backups (Cloud Console ou gcloud):
//      gcloud storage buckets create gs://scoreplace-firestore-backup \
//        --project=scoreplace-app \
//        --location=southamerica-east1 \
//        --uniform-bucket-level-access
//
// 2. Configurar lifecycle pra auto-delete após 30 dias:
//      cat > /tmp/lifecycle.json << 'JSON'
//      {"lifecycle":{"rule":[{"action":{"type":"Delete"},"condition":{"age":30}}]}}
//      JSON
//      gcloud storage buckets update gs://scoreplace-firestore-backup \
//        --lifecycle-file=/tmp/lifecycle.json
//
// 3. Conceder à service account das Functions a role
//    `Cloud Datastore Import Export Admin` E `Storage Admin` no bucket:
//      SA="$(gcloud projects describe scoreplace-app --format='value(projectNumber)')-compute@developer.gserviceaccount.com"
//      gcloud projects add-iam-policy-binding scoreplace-app \
//        --member="serviceAccount:$SA" \
//        --role="roles/datastore.importExportAdmin"
//      gcloud storage buckets add-iam-policy-binding \
//        gs://scoreplace-firestore-backup \
//        --member="serviceAccount:$SA" \
//        --role="roles/storage.admin"
//
// 4. Deploy:  firebase deploy --only functions:backupFirestore
//
// Depois do primeiro run, conferir no Cloud Console > Storage > o bucket
// que tem subpastas tipo `2026-04-29T04-00-00/` com `metadata` e `output-N`.
// Restore (manual em desastre):
//      gcloud firestore import gs://scoreplace-firestore-backup/<DATA>
//
// Doc completa: docs/backup.md
exports.backupFirestore = onSchedule(
  {
    schedule: "every day 04:00",
    timeZone: "America/Sao_Paulo",
    region: "southamerica-east1", // mesma region do bucket pra evitar egress
    timeoutSeconds: 540, // 9 min — export é assíncrono, só dispara o job
    memory: "256MiB",
    retryConfig: { retryCount: 1 },
  },
  async () => {
    const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || "scoreplace-app";
    const bucketName = "scoreplace-firestore-backup";
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const outputUriPrefix = `gs://${bucketName}/${ts}`;

    // Usa @google-cloud/firestore-admin via Admin SDK ou direct REST.
    // SDK mais limpo:
    const { FirestoreAdminClient } = require("@google-cloud/firestore").v1;
    const client = new FirestoreAdminClient();
    const databaseName = client.databasePath(projectId, "(default)");

    console.log(`[backupFirestore] disparando export pra ${outputUriPrefix}`);

    try {
      const [operation] = await client.exportDocuments({
        name: databaseName,
        outputUriPrefix: outputUriPrefix,
        collectionIds: [], // vazio = export tudo (alpha tem ~9 collections)
      });
      console.log(`[backupFirestore] operation iniciada:`, operation.name);
      // Não bloqueia esperando — export pode levar minutos. O Cloud Operations
      // log mostra progresso. Retorna sucesso assim que o job foi disparado.
    } catch (err) {
      console.error(`[backupFirestore] falha ao disparar export:`, err);
      throw err; // marca a função como falha pro retry kick in
    }
  }
);

// ─── Magic Link via Custom Email (firestore-send-email extension) ────────────
// v1.0.20-beta: substituí firebase.auth().sendSignInLinkToEmail() (que envia
// email feio do firebaseapp.com sem botão estilizado, parando no spam) por
// fluxo custom — gera o link via Admin SDK e enfileira email rico HTML com
// botão grande na collection `mail/` (a extension firestore-send-email envia).
//
// Bug reportado: "magic link continua indo pra spam e sem destaque num botão
// pra clicar". Os emails de notificação do app (criados pelo client via
// FirestoreDB.queueEmail → extension) já têm botões CTA estilizados —
// agora magic link segue o mesmo padrão.
//
// Deploy:  firebase deploy --only functions:sendMagicLink
exports.sendMagicLink = onCall(
  {
    region: "us-central1",
    memory: "256MiB",
    timeoutSeconds: 30,
    cors: ["https://scoreplace.app", "http://localhost:9876"],
  },
  async (request) => {
    const email = (request.data && request.data.email || "").trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new HttpsError("invalid-argument", "email inválido");
    }

    // Gera o link assinado oficial do Firebase. O frontend depois usará
    // `signInWithEmailLink(email, link)` pra completar — mesmo flow do
    // legacy.
    const actionCodeSettings = {
      url: `https://scoreplace.app/?eml=${encodeURIComponent(email)}#dashboard`,
      handleCodeInApp: true,
    };

    let firebaseLink;
    try {
      firebaseLink = await admin.auth().generateSignInWithEmailLink(email, actionCodeSettings);
    } catch (err) {
      console.error("[sendMagicLink] generateSignInWithEmailLink falhou:", err);
      throw new HttpsError("internal", "não foi possível gerar o link: " + (err.code || err.message));
    }

    // v1.0.30-beta: WRAPPER URL pra evitar prefetch consumindo o oobCode.
    // Bug reportado: usuários recebendo o email e clicando, mas vendo "link
    // expirado" porque algum scanner anti-phishing (Gmail/Outlook/corp
    // security) prefetcha o link pra checar e consume o oobCode antes do
    // humano clicar. Firebase oobCode é one-time-use → quem chega antes
    // ganha. Solução: o email aponta pra https://scoreplace.app/?ml=TOKEN
    // (URL nossa, prefetch não consome nada server-side); só quando o
    // browser real do humano carrega a página, o JS busca o firebaseLink
    // do Firestore e redireciona. Scanners fazem GET/HEAD da nossa URL,
    // não executam JS, então nunca alcançam o oobCode.
    const crypto = require("crypto");
    const token = crypto.randomBytes(18).toString("base64url");
    try {
      await admin.firestore().collection("magicLinks").doc(token).set({
        firebaseLink: firebaseLink,
        email: email,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        // expiresAt é só pra cleanup eventual — o oobCode em si tem expiry
        // próprio do Firebase (1h).
        expiresAt: new Date(Date.now() + 90 * 60 * 1000),
      });
    } catch (err) {
      console.error("[sendMagicLink] falha ao salvar magicLinks/" + token, err);
      throw new HttpsError("internal", "não foi possível registrar o link: " + (err.code || err.message));
    }
    const wrapperUrl = "https://scoreplace.app/?ml=" + encodeURIComponent(token);
    // Nome `link` mantido nas referências do HTML pra não mexer no template.
    const link = wrapperUrl;

    // HTML do email — botão grande âmbar, sem padrão "promocional" pra
    // reduzir spam classification. Header escuro + branding scoreplace.app +
    // CTA dominante + texto explicativo em copy direto.
    const html =
      '<!DOCTYPE html><html><head><meta charset="UTF-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1.0">' +
      '<title>Entrar no scoreplace.app</title></head>' +
      '<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;">' +
        '<table cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#0f172a;padding:40px 16px;">' +
          '<tr><td align="center">' +
            '<table cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:520px;background:#111827;border-radius:14px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.3);">' +
              // Header discreto — branding sem cor de destaque (só o botão
              // CTA recebe o âmbar pra não competir visualmente)
              '<tr><td style="padding:20px 32px 4px;text-align:center;">' +
                '<div style="font-size:1.4rem;line-height:1;margin-bottom:2px;">🎾</div>' +
                '<div style="font-size:0.92rem;font-weight:700;color:#fbbf24;letter-spacing:0.2px;">scoreplace.app</div>' +
              '</td></tr>' +
              // CTA primeiro — frase curta + botão grande, antes de qualquer
              // outra coisa. Pedido do user: "coloque o botao de entrar acima
              // de tudo só com a frase clico no botao para entrar acima dele".
              '<tr><td style="padding:24px 32px 8px;text-align:center;color:#e5e7eb;">' +
                '<p style="margin:0 0 16px;font-size:1rem;font-weight:600;color:#fff;">Clique no botão para entrar:</p>' +
                // Botão grande — table-based pra render consistente em Gmail/Outlook/Apple
                '<table cellspacing="0" cellpadding="0" border="0" align="center" style="margin:0 auto;">' +
                  '<tr><td style="border-radius:12px;background:linear-gradient(135deg,#fbbf24,#f59e0b);box-shadow:0 4px 12px rgba(251,191,36,0.3);">' +
                    '<a href="' + link.replace(/"/g, '&quot;') + '" style="display:inline-block;padding:18px 48px;color:#1e3a5f;text-decoration:none;font-weight:800;font-size:1.05rem;letter-spacing:0.3px;">' +
                      '🎾 Entrar no scoreplace.app' +
                    '</a>' +
                  '</td></tr>' +
                '</table>' +
              '</td></tr>' +
              // Detalhes secundários — só depois do CTA principal
              '<tr><td style="padding:20px 32px 28px;color:#cbd5e1;">' +
                '<p style="margin:0 0 16px;font-size:0.84rem;line-height:1.55;color:#94a3b8;text-align:center;">' +
                  'O link expira em 1 hora e só funciona uma vez.' +
                '</p>' +
                // Fallback link em texto (alguns clientes não renderizam o botão)
                '<p style="margin:16px 0 0;font-size:0.76rem;color:#94a3b8;line-height:1.5;border-top:1px solid #374151;padding-top:16px;">' +
                  'Não consegue clicar no botão? Copie e cole este endereço no navegador:<br>' +
                  '<span style="color:#cbd5e1;word-break:break-all;font-family:monospace;font-size:0.7rem;">' + link.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</span>' +
                '</p>' +
                '<p style="margin:16px 0 0;font-size:0.74rem;color:#94a3b8;line-height:1.5;">' +
                  'Não foi você? Pode ignorar — o link expira sozinho. ' +
                  'Se receber muitos desses sem ter pedido, contate <a href="mailto:scoreplace.app@gmail.com" style="color:#fbbf24;">scoreplace.app@gmail.com</a>.' +
                '</p>' +
              '</td></tr>' +
              // Footer minimalista
              '<tr><td style="padding:14px 32px;text-align:center;background:#0f172a;border-top:1px solid #1e293b;">' +
                '<p style="margin:0;font-size:0.7rem;color:#64748b;">scoreplace.app · Jogue em outro nível · ' + new Date().getFullYear() + '</p>' +
              '</td></tr>' +
            '</table>' +
          '</td></tr>' +
        '</table>' +
      '</body></html>';

    // Versão texto puro — filtros de spam penalizam HTML-only. Alternativa
    // plain/text garante que qualquer cliente de e-mail renderize algo e
    // melhora o spam score.
    const textBody =
      "scoreplace.app — seu link de acesso\n\n" +
      "Acesse o app clicando no link abaixo (ou copie e cole no navegador):\n\n" +
      link + "\n\n" +
      "O link expira em 1 hora e só funciona uma vez.\n\n" +
      "Não foi você? Pode ignorar — o link expira sozinho.\n" +
      "Dúvidas: scoreplace.app@gmail.com\n\n" +
      "scoreplace.app · Jogue em outro nível";

    // Enfileira na mail/ collection — extension firestore-send-email pega
    // e envia via SMTP configurado (scoreplace.app@gmail.com nesse momento).
    // v1.3.82-beta: subject menos "phishing-like" + text/plain alternativo
    // pra melhorar deliverability (emails HTML-only têm score de spam maior).
    try {
      await admin.firestore().collection("mail").add({
        to: [email],
        replyTo: "scoreplace.app@gmail.com",
        message: {
          subject: "scoreplace.app — seu link de acesso",
          html: html,
          text: textBody,
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log("[sendMagicLink] queued for", email);
      return { ok: true };
    } catch (err) {
      console.error("[sendMagicLink] falha ao enfileirar email:", err);
      throw new HttpsError("internal", "não foi possível enfileirar o email: " + (err.code || err.message));
    }
  }
);

// ─── WhatsApp via Evolution API (self-hosted no Railway) ────────────────────
// v1.3.37-beta: Cloud Function que consome `whatsapp_queue/{id}` (Firestore
// trigger onCreate) e POSTa pra Evolution API (https://docs.evolution-api.com).
// Evolution roda em Railway com WhatsApp Business pareado via QR Code num
// número eSIM Vivo dedicado. Custo total: ~R$20/mês (eSIM) + R$0-5/mês
// (Railway free tier).
//
// PRÉ-REQUISITOS pra ativar (one-time, fora do código):
//   1. Deploy Evolution API no Railway — ver infra/whatsapp/README.md
//   2. Parear instância via QR Code com o WhatsApp Business do eSIM
//   3. Configurar 3 secrets:
//        firebase functions:secrets:set EVOLUTION_API_URL
//        firebase functions:secrets:set EVOLUTION_API_KEY
//        firebase functions:secrets:set EVOLUTION_INSTANCE
//   4. Deploy:  firebase deploy --only functions:processWhatsAppQueue
//
// Schema do doc em whatsapp_queue/{id} (criado por FirestoreDB.queueWhatsApp):
//   {
//     phones: ['5511999998888', ...],   // E.164 sem '+' nem espaços
//     message: 'texto da mensagem',
//     createdAt: ISO string,
//     status: 'pending' | 'sent' | 'partial' | 'failed',
//     // Atualizado pela função:
//     processedAt?: ISO string,
//     attempts?: number,
//     lastError?: string,
//     deliveries?: { phone, ok, messageId?, error? }[]
//   }

const EVOLUTION_API_URL = defineSecret("EVOLUTION_API_URL");
const EVOLUTION_API_KEY = defineSecret("EVOLUTION_API_KEY");
const EVOLUTION_INSTANCE = defineSecret("EVOLUTION_INSTANCE");

// ─── WhatsApp Magic Link ──────────────────────────────────────────────────────
// v1.3.83-beta: quando o usuário entra com telefone, o frontend também chama
// esta função em paralelo com o Firebase SMS. Se o número estiver cadastrado
// no WhatsApp, o usuário recebe um link direto que loga sem precisar digitar o
// código SMS — usa signInWithCustomToken no cliente.
//
// Fluxo:
//   1. Verifica se o número existe no Firebase Auth (getUserByPhoneNumber).
//   2. Gera um custom token via Admin SDK (admin.auth().createCustomToken(uid)).
//   3. Armazena wrapper em magicLinks/{token} com type='customToken'.
//   4. Envia mensagem WhatsApp com link scoreplace.app/?wt=TOKEN.
//   5. Se usuário não existe ainda (primeiro login) → retorna ok:false silencioso.
//      SMS continua sendo o caminho principal nesse caso.
//
// O cliente detecta ?wt=TOKEN em auth.js, busca o Firestore, chama
// signInWithCustomToken — login direto, zero digitação.
//
// Deploy: firebase deploy --only functions:sendWhatsAppMagicLink
exports.sendWhatsAppMagicLink = onCall(
  {
    region: "us-central1",
    memory: "256MiB",
    timeoutSeconds: 30,
    secrets: [EVOLUTION_API_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE],
  },
  async (request) => {
    const rawPhone = (request.data && request.data.phone || "").trim();
    const phone = _normalizePhoneE164(rawPhone);
    if (!phone) {
      // Número inválido — silencioso, SMS continua.
      return { ok: false, reason: "invalid-phone" };
    }

    // Busca conta existente ou cria nova — o link funciona pra novos usuários também.
    // Seguro: o link WhatsApp vai pro dono do número; quem recebe no WhatsApp é quem
    // tem o telefone, independente de já ter conta ou não.
    let userRecord;
    try {
      userRecord = await admin.auth().getUserByPhoneNumber("+" + phone);
    } catch (err) {
      if (err.code === "auth/user-not-found") {
        // Novo usuário — cria conta Firebase Auth com o número para poder gerar custom token.
        // O SMS do OTP já passou pelo reCAPTCHA do Firebase, então o número é válido.
        try {
          userRecord = await admin.auth().createUser({ phoneNumber: "+" + phone });
          console.log("[sendWhatsAppMagicLink] new user created for phone:", phone, "uid:", userRecord.uid);
        } catch (createErr) {
          console.error("[sendWhatsAppMagicLink] createUser failed:", createErr.code || createErr.message);
          return { ok: false, reason: "create-user-error" };
        }
      } else {
        console.error("[sendWhatsAppMagicLink] getUserByPhoneNumber failed:", err.code || err.message);
        return { ok: false, reason: "lookup-error" };
      }
    }

    // Gera custom token com validade de 1h (Firebase default é 1h pra custom tokens).
    let customToken;
    try {
      customToken = await admin.auth().createCustomToken(userRecord.uid, {
        source: "whatsapp_magic_link",
      });
    } catch (err) {
      console.error("[sendWhatsAppMagicLink] createCustomToken failed:", err.code || err.message);
      return { ok: false, reason: "token-error" };
    }

    // Armazena wrapper no mesmo schema que o email magic link usa.
    const crypto = require("crypto");
    const token = crypto.randomBytes(18).toString("base64url");
    try {
      await admin.firestore().collection("magicLinks").doc(token).set({
        type: "customToken",
        customToken: customToken,
        uid: userRecord.uid,
        phone: phone,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1h
      });
    } catch (err) {
      console.error("[sendWhatsAppMagicLink] Firestore write failed:", err.code || err.message);
      return { ok: false, reason: "store-error" };
    }

    const wrapperUrl = "https://scoreplace.app/?wt=" + encodeURIComponent(token);

    // Nome de exibição para personalizar a mensagem.
    const displayName = (userRecord.displayName || "").trim();
    const firstName = displayName ? displayName.split(/[\s.]+/)[0] : "";
    const greeting = firstName ? "Olá, " + firstName + "!" : "Olá!";

    const message =
      "🎾 " + greeting + "\n\n" +
      "Acesse o *scoreplace.app* pelo link abaixo — sem digitar nenhum código:\n\n" +
      wrapperUrl + "\n\n" +
      "_O link expira em 1 hora. Se não pediu, ignore._";

    // Envia direto pela Evolution API (não usa a fila — link de login é time-sensitive).
    let apiUrl, apiKey, instance;
    try {
      apiUrl = EVOLUTION_API_URL.value();
      apiKey = EVOLUTION_API_KEY.value();
      instance = EVOLUTION_INSTANCE.value();
    } catch (err) {
      console.error("[sendWhatsAppMagicLink] secrets unavailable:", err.message);
      return { ok: false, reason: "secrets-missing" };
    }

    const result = await _sendWhatsAppText(apiUrl, apiKey, instance, phone, message);
    if (!result.ok) {
      console.warn("[sendWhatsAppMagicLink] WA send failed for", phone, ":", result.error);
      // Não joga erro — SMS já foi enviado, isto é bônus best-effort.
      return { ok: false, reason: "wa-send-failed", error: result.error };
    }

    console.log("[sendWhatsAppMagicLink] sent to", phone, "uid:", userRecord.uid);
    return { ok: true };
  }
);

// Sanitiza telefone pra E.164 sem '+' (formato Evolution API espera).
// Aceita "+55 11 99999-8888", "55 11 99999-8888", "11 99999-8888",
// "(11) 99999-8888". Sempre normaliza pra "5511999998888".
function _normalizePhoneE164(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length < 10) return null; // muito curto pra ser número BR
  // Se já começa com 55 e tem 12-13 dígitos (DDD + 8/9 digit number), ok.
  if (digits.length === 12 || digits.length === 13) {
    if (digits.startsWith("55")) return digits;
  }
  // Se tem 10-11 dígitos (DDD+número, sem DDI), assume BR e prefixa 55.
  if (digits.length === 10 || digits.length === 11) {
    return "55" + digits;
  }
  // Outro DDI ou número internacional — devolve como veio (sem '+').
  return digits;
}

// Send single WhatsApp text via Evolution. Retorna { ok, messageId?, error? }.
async function _sendWhatsAppText(apiUrl, apiKey, instance, phone, text) {
  const url = apiUrl.replace(/\/+$/, "") + "/message/sendText/" + encodeURIComponent(instance);
  const body = {
    number: phone,
    text: text,
    // Evolution-specific options:
    delay: 1200, // ms entre msgs (parece + humano, evita ban)
    linkPreview: true,
  };
  let resp;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": apiKey,
      },
      body: JSON.stringify(body),
      // Cloud Functions timeout é 60s — fetch sem timeout pode travar a função.
      // node-fetch v2 não tem timeout nativo; usar AbortController.
    });
  } catch (e) {
    return { ok: false, error: "fetch failed: " + (e.message || String(e)) };
  }
  let data = null;
  try { data = await resp.json(); } catch (e) { /* body não-json */ }
  if (!resp.ok) {
    return {
      ok: false,
      error: "HTTP " + resp.status + ": " + (data && data.message ? JSON.stringify(data.message) : resp.statusText),
    };
  }
  // Resposta sucesso típica: { key: { id: "..." }, ... }
  const messageId = data && data.key && data.key.id ? data.key.id : null;
  return { ok: true, messageId: messageId };
}

exports.processWhatsAppQueue = onDocumentCreated(
  {
    document: "whatsapp_queue/{queueId}",
    region: "us-central1",
    timeoutSeconds: 60,
    memory: "256MiB",
    secrets: [EVOLUTION_API_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE],
    retryConfig: { retryCount: 2 }, // Firebase auto-retries 2x em caso de unhandled error
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const data = snap.data();
    if (!data || !data.message || !Array.isArray(data.phones) || data.phones.length === 0) {
      console.warn("[processWhatsAppQueue] doc inválido — skip:", event.params.queueId);
      await snap.ref.update({
        status: "failed",
        lastError: "missing phones[] or message",
        processedAt: new Date().toISOString(),
      });
      return;
    }
    // Idempotência: se já processado (retry do trigger), skip
    if (data.status === "sent" || data.status === "partial") return;

    const apiUrl = EVOLUTION_API_URL.value();
    const apiKey = EVOLUTION_API_KEY.value();
    const instance = EVOLUTION_INSTANCE.value();
    if (!apiUrl || !apiKey || !instance) {
      console.error("[processWhatsAppQueue] secrets ausentes");
      await snap.ref.update({
        status: "failed",
        lastError: "Evolution secrets not configured",
        processedAt: new Date().toISOString(),
      });
      return;
    }

    const deliveries = [];
    for (const rawPhone of data.phones) {
      const phone = _normalizePhoneE164(rawPhone);
      if (!phone) {
        deliveries.push({ phone: String(rawPhone), ok: false, error: "invalid phone format" });
        continue;
      }
      const result = await _sendWhatsAppText(apiUrl, apiKey, instance, phone, data.message);
      // Omitir campos undefined — Firestore rejeita undefined como valor
      const delivery = { phone: phone, ok: result.ok };
      if (result.messageId !== undefined) delivery.messageId = result.messageId;
      if (result.error !== undefined) delivery.error = result.error;
      deliveries.push(delivery);
      // Pequena pausa entre msgs múltiplas — Evolution já tem delay interno
      // mas adicional 200ms reduz chance de rate-limit do WhatsApp Web.
      if (data.phones.length > 1) await new Promise((r) => setTimeout(r, 200));
    }

    const okCount = deliveries.filter((d) => d.ok).length;
    const totalCount = deliveries.length;
    const status = okCount === totalCount ? "sent" : (okCount === 0 ? "failed" : "partial");
    const attempts = (data.attempts || 0) + 1;

    await snap.ref.update({
      status: status,
      attempts: attempts,
      processedAt: new Date().toISOString(),
      deliveries: deliveries,
      lastError: status === "failed" ? (deliveries[0] && deliveries[0].error) || "unknown" : admin.firestore.FieldValue.delete(),
    });

    console.log(`[processWhatsAppQueue] ${event.params.queueId}: ${okCount}/${totalCount} entregues`);
  }
);

// ─── Scheduled cleanup: WhatsApp queue antigos ────────────────────────────
// Roda diariamente 03:45 BRT, deleta docs `sent`/`failed` com mais de 30 dias.
// `pending` não toca — pode estar em retry.
exports.cleanupOldWhatsAppQueue = onSchedule(
  {
    schedule: "every day 03:45",
    timeZone: "America/Sao_Paulo",
    region: "us-central1",
  },
  async () => {
    const db = admin.firestore();
    const threshold = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const query = db.collection("whatsapp_queue")
      .where("status", "in", ["sent", "failed"])
      .where("processedAt", "<", threshold);
    const deleted = await _batchDeleteQuery(query);
    console.log(`[cleanupOldWhatsAppQueue] deleted ${deleted} docs (threshold: ${threshold})`);
  }
);

// ─── notifyLeagueRoundWhatsApp ─────────────────────────────────────────────
// Chamada pelo cliente após sortear nova rodada da Liga/Suíço.
// Para cada partida da rodada, busca o telefone de cada jogador no Firestore,
// cria um grupo no WhatsApp com eles via Evolution API e envia uma mensagem
// informando que precisam combinar o jogo e lançar o resultado antes do
// próximo sorteio agendado.
//
// Input: {
//   tournamentId: string,
//   roundIndex: number,       // índice do round em t.rounds (0-based)
//   nextDrawDateStr: string,  // "DD/MM/YYYY às HH:MM" ou "Não agendado"
// }
// Output: { ok: true, groups: [{match, created, groupJid, error?}] }
exports.notifyLeagueRoundWhatsApp = onCall(
  {
    region: "us-central1",
    timeoutSeconds: 120,
    memory: "256MiB",
    secrets: [EVOLUTION_API_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE],
  },
  async (request) => {
    const { tournamentId, roundIndex, nextDrawDateStr } = request.data || {};
    if (!tournamentId) return { ok: false, reason: "missing-tournament-id" };

    const db = admin.firestore();
    const apiUrl = EVOLUTION_API_URL.value();
    const apiKey = EVOLUTION_API_KEY.value();
    const instance = EVOLUTION_INSTANCE.value();

    // ── 1. Fetch tournament ──────────────────────────────────────────
    let t;
    try {
      const snap = await db.collection("tournaments").doc(String(tournamentId)).get();
      if (!snap.exists) return { ok: false, reason: "tournament-not-found" };
      t = snap.data();
    } catch (e) {
      console.error("[notifyLeagueRoundWhatsApp] fetch tournament failed:", e.message);
      return { ok: false, reason: "firestore-error" };
    }

    // ── 2. Get the round ────────────────────────────────────────────
    const rounds = t.rounds || [];
    const ri = (typeof roundIndex === "number") ? roundIndex : rounds.length - 1;
    const round = rounds[ri];
    if (!round || !Array.isArray(round.matches)) {
      return { ok: false, reason: "round-not-found" };
    }
    const realMatches = round.matches.filter((m) => !m.isSitOut && !m.isBye);
    if (realMatches.length === 0) return { ok: false, reason: "no-matches" };

    // ── 3. Build phone lookup from participants + users collection ───
    // participants[] can have: { displayName, name, uid, email, phone }
    const participants = Array.isArray(t.participants)
      ? t.participants
      : Object.values(t.participants || {});

    // Map: normalizedName → { uid, email, phone }
    // For doubles teams ("Alice/Bob"), we add entries for:
    //  1. The full team name ("alice/bob") → primary registrant's uid/email/phone
    //  2. Each nested member in p.participants[] → their own uid/email/phone (best path)
    //  3. Each slash-split individual ("alice", "bob") → fallback to team entry
    // This ensures resolvePhone works for all 4 players in a doubles match.
    const participantMap = {};
    const normalize = (s) => String(s || "").trim().toLowerCase();
    participants.forEach((p) => {
      if (!p || typeof p !== "object") return;
      const fullName = normalize(p.displayName || p.name || "");
      const teamEntry = {
        uid: p.uid || null,
        email: p.email || null,
        phone: p.phone || null,
      };
      if (fullName) participantMap[fullName] = teamEntry;

      // Path 1: nested participants[] — each member has their own uid (doubles teams with full data)
      if (Array.isArray(p.participants)) {
        p.participants.forEach((member) => {
          if (!member || typeof member !== "object") return;
          const mName = normalize(member.displayName || member.name || "");
          if (mName && !participantMap[mName]) {
            participantMap[mName] = {
              uid: member.uid || null,
              email: member.email || null,
              phone: member.phone || null,
            };
          }
        });
      }

      // Path 2: slash-split fallback — "alice/bob" → also map "alice" and "bob"
      // Points to the team entry (uid = primary registrant); at minimum, the primary's
      // phone will be found. If the partner has their own nested entry (path 1), that
      // was already added above and won't be overwritten here (check `!participantMap[m]`).
      if (fullName && fullName.includes("/")) {
        fullName.split("/").map((s) => s.trim()).filter(Boolean).forEach((m) => {
          const mKey = normalize(m);
          if (mKey && !participantMap[mKey]) {
            participantMap[mKey] = teamEntry;
          }
        });
      }
    });

    // Resolve phone for a player name: first from participants map, then
    // from users collection (by uid or by email_lower).
    async function resolvePhone(playerName) {
      const key = normalize(playerName);
      const entry = participantMap[key];
      if (!entry) return null;
      // Direct phone on participant record
      if (entry.phone) return _normalizePhone(entry.phone);
      // Look up by uid
      if (entry.uid) {
        try {
          const userDoc = await db.collection("users").doc(entry.uid).get();
          if (userDoc.exists) {
            const phone = (userDoc.data() || {}).phone;
            if (phone) return _normalizePhone(phone);
          }
        } catch (_) {}
      }
      // Look up by email_lower (field stored by the app)
      if (entry.email) {
        try {
          const emailLower = String(entry.email).toLowerCase().trim();
          const q = await db.collection("users")
            .where("email_lower", "==", emailLower).limit(1).get();
          if (!q.empty) {
            const phone = (q.docs[0].data() || {}).phone;
            if (phone) return _normalizePhone(phone);
          }
        } catch (_) {}
      }
      return null;
    }

    const tournamentName = t.name || "Liga";
    const roundNumber = ri + 1;
    const tId = String(tournamentId);

    // ── 4. For each match: create WA group + send message ───────────
    const results = [];
    for (const match of realMatches) {
      // Extract player names (supports singles p1/p2 and doubles team1/team2)
      let playerNames = [];
      if (Array.isArray(match.team1) && match.team1.length > 0) {
        playerNames = [...match.team1, ...(match.team2 || [])];
      } else {
        if (match.p1) playerNames.push(match.p1);
        if (match.p2) playerNames.push(match.p2);
      }
      // For doubles: expand "Alice/Bob" → ["Alice/Bob", "Alice", "Bob"]
      // We include both the full team name AND individual members so that resolvePhone
      // can match via the team-key fallback AND via individual participant entries.
      const expandedNames = [];
      playerNames.forEach((n) => {
        const teamName = String(n).trim();
        if (!teamName) return;
        expandedNames.push(teamName); // full name (e.g. "Alice/Bob") — covers slash-map fallback
        if (teamName.includes("/")) {
          // Also add individual members so their own uid/phone can be found
          teamName.split("/").map((s) => s.trim()).filter(Boolean).forEach((m) => {
            if (m && m !== teamName) expandedNames.push(m);
          });
        }
      });

      // Resolve phones (in parallel) — deduplicate so same phone isn't added twice
      // (e.g. "Alice/Bob" and "Alice" both resolving to Alice's phone)
      const phoneResults = await Promise.all(expandedNames.map(resolvePhone));
      const phones = [...new Set(phoneResults.filter(Boolean))];

      if (phones.length < 2) {
        console.log(`[notifyLeagueRoundWhatsApp] match "${match.p1 || (match.team1||[]).join('+')} vs ${match.p2 || (match.team2||[]).join('+')}": only ${phones.length} phone(s) found — skipping group creation`);
        results.push({ match: `${match.p1} vs ${match.p2}`, created: false, reason: "insufficient-phones" });
        continue;
      }

      // Group subject — max 100 chars for WA
      const matchLabel = Array.isArray(match.team1)
        ? `${(match.team1 || []).join("+")} vs ${(match.team2 || []).join("+")}`
        : `${match.p1 || "?"} vs ${match.p2 || "?"}`;
      const subject = `${tournamentName} R${roundNumber}: ${matchLabel}`.substring(0, 100);

      // Message body
      const nextDrawLabel = nextDrawDateStr || "Não agendado";
      const link = `https://scoreplace.app/#bracket/${tId}`;
      const message =
        `🎾 *${tournamentName} — Rodada ${roundNumber}*\n\n` +
        `Olá! Vocês foram sorteados para jogar juntos nesta rodada.\n\n` +
        `📋 *Partida:* ${matchLabel}\n` +
        `⏰ *Prazo:* Lancem o resultado antes do próximo sorteio:\n` +
        `📅 *Próximo sorteio:* ${nextDrawLabel}\n\n` +
        `Combinem o horário aqui no grupo e registrem o placar no app:\n${link}`;

      // ── Create group ────────────────────────────────────────────────
      let groupJid = null;
      try {
        const createUrl = apiUrl.replace(/\/+$/, "") + "/group/create/" + encodeURIComponent(instance);
        // Evolution API expects participants as "55XXXXXXXXXXX" (no @s.whatsapp.net for creation)
        const participantsList = phones.map((p) => p.replace(/[^0-9]/g, ""));
        const createResp = await fetch(createUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": apiKey,
          },
          body: JSON.stringify({
            subject: subject,
            description: `Partida da ${tournamentName}. Combinem e lancem o resultado antes de ${nextDrawLabel}.`,
            participants: participantsList,
          }),
        });
        const createData = await createResp.json().catch(() => null);
        if (!createResp.ok) {
          const errMsg = (createData && createData.message) ? JSON.stringify(createData.message) : createResp.statusText;
          console.error(`[notifyLeagueRoundWhatsApp] group create failed for "${matchLabel}": HTTP ${createResp.status} — ${errMsg}`);
          results.push({ match: matchLabel, created: false, reason: `group-create-failed: ${createResp.status}` });
          continue;
        }
        // Extract group JID — Evolution returns different shapes depending on version
        groupJid =
          (createData && createData._serialized) ||
          (createData && createData.id && createData.id._serialized) ||
          (createData && createData.id && typeof createData.id === "string" ? createData.id : null) ||
          null;
        if (!groupJid && createData) {
          // Try to find any key containing "@g.us"
          const raw = JSON.stringify(createData);
          const m = raw.match(/"([0-9\-]+@g\.us)"/);
          if (m) groupJid = m[1];
        }
        console.log(`[notifyLeagueRoundWhatsApp] group created for "${matchLabel}": jid=${groupJid}`);
      } catch (e) {
        console.error(`[notifyLeagueRoundWhatsApp] group create exception for "${matchLabel}":`, e.message);
        results.push({ match: matchLabel, created: false, reason: `group-create-exception: ${e.message}` });
        continue;
      }

      if (!groupJid) {
        results.push({ match: matchLabel, created: true, groupJid: null, reason: "group-jid-not-found-in-response" });
        continue;
      }

      // Small delay before sending message
      await new Promise((r) => setTimeout(r, 1500));

      // ── Send message to the group ───────────────────────────────────
      const msgResult = await _sendWhatsAppText(apiUrl, apiKey, instance, groupJid, message);
      console.log(`[notifyLeagueRoundWhatsApp] message to group ${groupJid}:`, msgResult.ok ? "ok" : msgResult.error);
      results.push({ match: matchLabel, created: true, groupJid, messageSent: msgResult.ok, messageError: msgResult.error });

      // Small delay between groups to avoid rate limiting
      await new Promise((r) => setTimeout(r, 1000));
    }

    const created = results.filter((r) => r.created).length;
    console.log(`[notifyLeagueRoundWhatsApp] tournament ${tId} round ${roundNumber}: ${created}/${realMatches.length} groups created`);
    return { ok: true, groups: results };
  }
);

// ─── Retroactive Trophy Backfill ─────────────────────────────────────────────
// Callable function that sweeps ALL existing users and awards trophies/milestones
// based on their historical Firestore data.  Uses Admin SDK so it bypasses
// Firestore security rules (no user login required per target uid).
//
// Only callable by the app owner (rstbarth@gmail.com).
// Expected runtime: a few minutes for tens of users; ~5-10 min for hundreds.
//
// Trophies that depend on real-time event payload (madrugador, noturno, virada)
// are SKIPPED in backfill — they will be awarded going forward on new events.
//
// Returns: { processed, trophiesAwarded, milestonesAwarded, errors, counts }
//
// Trigger from the app: click "🔧 Backfill Troféus" on the admin dashboard panel.

// ── Inline trophy conditions (ported from trophy-catalog.js) ─────────────────
// Only includes trophies that CAN be retroactively verified from stored data.
const BACKFILL_TROPHY_DEFS = [
  // PERFIL
  { id: "perfil_completo",    check: (u, s) => !!(u.displayName && u.preferredSports && u.preferredSports.length > 0 && u.gender && u.city && (u.skill || (u.skillBySport && Object.keys(u.skillBySport).length > 0))) },
  { id: "perfil_foto",        check: (u, s) => !!(u.photoURL && u.photoURL.includes("googleusercontent")) },
  { id: "perfil_local",       check: (u, s) => !!(u.preferredLocations && u.preferredLocations.length > 0) },
  { id: "perfil_skills",      check: (u, s) => !!(u.skillBySport && Object.keys(u.skillBySport).length >= 3) },
  // CASUAIS
  { id: "casual_primeira",            check: (u, s) => (s.casualMatchesPlayed || 0) >= 1 },
  { id: "casual_primeira_vitoria",    check: (u, s) => (s.casualMatchesWon || 0) >= 1 },
  { id: "casual_multimodalidade",     check: (u, s) => (s.casualSportsPlayed || 0) >= 3 },
  { id: "casual_maratonista",         check: (u, s) => (s.casualActiveDaysThisMonth || 0) >= 7 },
  // especial_all_modalities
  { id: "especial_all_modalities",    check: (u, s) => (s.casualSportsPlayed || 0) >= 9 },
  // TORNEIOS
  { id: "torneio_primeiro_inscrito",  check: (u, s) => (s.tournamentsEnrolled || 0) >= 1 },
  { id: "torneio_campeao",            check: (u, s) => (s.tournamentWins || 0) >= 1 },
  { id: "torneio_liga",               check: (u, s) => (s.ligaParticipations || 0) >= 1 },
  { id: "torneio_criou_primeiro",     check: (u, s) => (s.tournamentsCreated || 0) >= 1 },
  { id: "especial_organizador_serie", check: (u, s) => (s.tournamentsWithTenPlus || 0) >= 5 },
  // PRESENÇA
  { id: "presenca_primeira",          check: (u, s) => (s.checkinsTotal || 0) >= 1 },
  { id: "presenca_planejou",          check: (u, s) => (s.plansCreated || 0) >= 1 },
  { id: "presenca_3_locais",          check: (u, s) => (s.uniqueVenuesVisited || 0) >= 3 },
  { id: "presenca_toda_semana",       check: (u, s) => (s.checkInWeekStreak || 0) >= 4 },
  // SOCIAL
  { id: "social_primeiro_amigo",      check: (u, s) => (s.friendsCount || 0) >= 1 },
  { id: "social_encontrou_amigos",    check: (u, s) => (s.friendsCount || 0) >= 5 },
  { id: "social_convidou",            check: (u, s) => (s.invitesSent || 0) >= 1 },
  { id: "social_notificou_amigos",    check: (u, s) => (s.friendNotifications || 0) >= 5 },
  // ESPECIAL FUNDADOR (criou conta antes de 2026-06-01)
  { id: "especial_fundador",          check: (u, s) => {
    if (!u.createdAt) return false;
    return new Date(u.createdAt) < new Date("2026-06-01T00:00:00Z");
  }},
];

// Milestones: id, metric, step, startAt
const BACKFILL_MILESTONES = [
  { id: "milestone_casual_jogadas",              metric: "casualMatchesPlayed",  step: 25, startAt: 25 },
  { id: "milestone_casual_vitorias",             metric: "casualMatchesWon",     step: 25, startAt: 25 },
  { id: "milestone_torneios_participados",       metric: "tournamentsEnrolled",  step: 3,  startAt: 3  },
  { id: "milestone_torneios_campeao",            metric: "tournamentWins",       step: 2,  startAt: 2  },
  { id: "milestone_torneios_criados",            metric: "tournamentsCreated",   step: 3,  startAt: 3  },
  { id: "milestone_partidas_torneio_vitorias",   metric: "tournamentMatchesWon", step: 25, startAt: 25 },
  { id: "milestone_checkins",                    metric: "checkinsTotal",        step: 10, startAt: 10 },
  { id: "milestone_locais_visitados",            metric: "uniqueVenuesVisited",  step: 5,  startAt: 5  },
  { id: "milestone_amigos",                      metric: "friendsCount",         step: 5,  startAt: 5  },
];

function _milestoneTierFromLevel(level) {
  if (level <= 4)  return "bronze";
  if (level <= 8)  return "prata";
  if (level <= 12) return "ouro";
  return "platina";
}

function _trophyTierFromPct(pct) {
  if (pct > 60) return "bronze";
  if (pct > 20) return "prata";
  if (pct > 5)  return "ouro";
  return "platina";
}

// Compute all user stats from Firestore collections
async function _computeBackfillStats(db, uid, userData) {
  const email = (userData.email || "").toLowerCase();
  const stats = {
    friendsCount:              (userData.friends && userData.friends.length) || 0,
    invitesSent:               userData.invitesSent || 0,
    friendNotifications:       userData.friendNotifications || 0,
    activityDayStreak:         userData.activityDayStreak || 0,
    checkInWeekStreak:         userData.checkInWeekStreak || 0,
    casualActiveDaysThisMonth: userData.casualActiveDaysThisMonth || 0,
    casualMatchesPlayed:       0,
    casualMatchesWon:          0,
    casualSportsPlayed:        0,
    tournamentsEnrolled:       0,
    tournamentWins:            0,
    tournamentPodiums:         0,
    ligaParticipations:        0,
    tournamentsWithTenPlus:    0,
    tournamentsCreated:        0,
    tournamentMatchesWon:      0,
    checkinsTotal:             0,
    uniqueVenuesVisited:       0,
    plansCreated:              0,
  };

  const LIGA_KEYWORDS = ["Liga", "Ranking", "Suíço", "Suico", "Swiss"];

  const queries = [
    // Casual matches where user is host
    db.collection("casualMatches")
      .where("hostUid", "==", uid)
      .where("status", "==", "finished")
      .get()
      .then((snap) => {
        const sportsSet = {};
        snap.forEach((doc) => {
          const d = doc.data();
          stats.casualMatchesPlayed++;
          if (d.winner === d.hostColor) stats.casualMatchesWon++;
          if (d.sport) sportsSet[d.sport] = true;
        });
        stats.casualSportsPlayed = Object.keys(sportsSet).length;
      })
      .catch(() => {}),

    // Casual matches where user is guest (any uid field)
    db.collection("casualMatches")
      .where("guestUid", "==", uid)
      .where("status", "==", "finished")
      .get()
      .then((snap) => {
        snap.forEach((doc) => {
          const d = doc.data();
          stats.casualMatchesPlayed++;
          if (d.winner === d.guestColor) stats.casualMatchesWon++;
        });
      })
      .catch(() => {}),

    // Tournaments the user is enrolled in
    ...(email ? [
      db.collection("tournaments")
        .where("memberEmails", "array-contains", email)
        .get()
        .then((snap) => {
          snap.forEach((doc) => {
            const t = doc.data();
            stats.tournamentsEnrolled++;
            // Liga / Suíço check
            if (t.format && LIGA_KEYWORDS.some((k) => t.format.includes(k))) {
              stats.ligaParticipations++;
            }
            // Win check
            const displayName = userData.displayName || "";
            if (t.winner && (t.winner === displayName || t.winner === email)) {
              stats.tournamentWins++;
            }
            // Organizer with 10+ participants
            if ((t.organizerEmail === email || t.organizerUid === uid)) {
              const count = (t.participants && t.participants.length) || 0;
              if (count >= 10) stats.tournamentsWithTenPlus++;
            }
          });
        })
        .catch(() => {})
    ] : []),

    // Tournaments created
    ...(email ? [
      db.collection("tournaments")
        .where("organizerEmail", "==", email)
        .get()
        .then((snap) => { stats.tournamentsCreated = snap.size; })
        .catch(() => {})
    ] : []),

    // Presences
    db.collection("presences")
      .where("uid", "==", uid)
      .where("type", "in", ["checkin", "plan"])
      .get()
      .then((snap) => {
        const venueSet = {};
        snap.forEach((doc) => {
          const d = doc.data();
          if (d.type === "checkin") {
            stats.checkinsTotal++;
            if (d.placeId) venueSet[d.placeId] = true;
          }
          if (d.type === "plan") stats.plansCreated++;
        });
        stats.uniqueVenuesVisited = Object.keys(venueSet).length;
      })
      .catch(() => {}),
  ];

  await Promise.all(queries);
  return stats;
}

exports.backfillAllUserTrophies = onCall(
  {
    region: "us-central1",
    memory: "512MiB",
    timeoutSeconds: 540,
    cors: ["https://scoreplace.app", "http://localhost:9876"],
  },
  async (request) => {
    // ── Auth guard: only owner ───────────────────────────────────────────────
    const callerUid = request.auth && request.auth.uid;
    if (!callerUid) throw new HttpsError("unauthenticated", "Login required");

    const db = admin.firestore();
    const callerDoc = await db.collection("users").doc(callerUid).get().catch(() => null);
    if (!callerDoc || !callerDoc.exists) throw new HttpsError("permission-denied", "No profile");
    const callerData = callerDoc.data() || {};
    if (callerData.email !== "rstbarth@gmail.com") {
      throw new HttpsError("permission-denied", "Owner only");
    }

    // ── Fetch all user docs ──────────────────────────────────────────────────
    const usersSnap = await db.collection("users").get();
    const totalUsers = usersSnap.docs.filter((d) => d.data() && d.data().email).length;
    console.log(`[backfill] Starting trophy backfill: ${totalUsers} users with profiles`);

    // Update totalUsers in trophyStats so rarity calculations work
    await db.collection("_meta").doc("trophyStats").set(
      { totalUsers: Math.max(totalUsers, 1) },
      { merge: true }
    ).catch(() => {});

    let processed = 0;
    let trophiesAwarded = 0;
    let milestonesAwarded = 0;
    let errors = 0;
    const trophyCounts = {};  // trophyId → how many new awards

    for (const userDoc of usersSnap.docs) {
      const uid = userDoc.id;
      const userData = userDoc.data() || {};
      if (!userData.email) continue;  // skip incomplete/ghost docs

      try {
        // ── 1. Compute stats ───────────────────────────────────────────────
        const stats = await _computeBackfillStats(db, uid, userData);

        // ── 2. Load existing trophies (idempotent) ─────────────────────────
        const existTrophySnap = await db.collection("users").doc(uid)
          .collection("trophies").get().catch(() => null);
        const existTrophies = {};
        if (existTrophySnap) existTrophySnap.forEach((d) => { existTrophies[d.id] = true; });

        // ── 3. Check and award trophies ────────────────────────────────────
        const newTrophies = [];
        for (const def of BACKFILL_TROPHY_DEFS) {
          if (existTrophies[def.id]) continue;
          try {
            if (def.check(userData, stats)) newTrophies.push(def.id);
          } catch (_) {}
        }

        if (newTrophies.length > 0) {
          const now = new Date().toISOString();
          // Use batched writes (max 500 per batch)
          for (let i = 0; i < newTrophies.length; i += 400) {
            const batch = db.batch();
            const chunk = newTrophies.slice(i, i + 400);
            for (const tid of chunk) {
              // Tier starts as bronze; will be recalculated client-side when user opens trophies page
              const ref = db.collection("users").doc(uid).collection("trophies").doc(tid);
              batch.set(ref, { awardedAt: now, tier: "bronze", backfilled: true });
              trophyCounts[tid] = (trophyCounts[tid] || 0) + 1;
            }
            await batch.commit();
            trophiesAwarded += chunk.length;
          }
        }

        // ── 4. Check milestones ────────────────────────────────────────────
        const existMilestoneSnap = await db.collection("users").doc(uid)
          .collection("milestones").get().catch(() => null);
        const existMilestones = {};
        if (existMilestoneSnap) existMilestoneSnap.forEach((d) => {
          existMilestones[d.id] = d.data() || {};
        });

        const milestoneBatch = db.batch();
        let hasMilestoneBatch = false;

        for (const ms of BACKFILL_MILESTONES) {
          const currentValue = stats[ms.metric] || 0;
          if (currentValue < ms.startAt) continue;

          const newLevel = Math.floor((currentValue - ms.startAt) / ms.step) + 1;
          if (newLevel <= 0) continue;

          const prevLevel = (existMilestones[ms.id] && existMilestones[ms.id].level) || 0;
          if (newLevel <= prevLevel) continue;

          const now = new Date().toISOString();

          // Award individual level documents for new levels
          for (let lvl = prevLevel + 1; lvl <= newLevel; lvl++) {
            // Check if this level doc already exists
            const levelId = ms.id + "_" + lvl;
            if (existMilestones[levelId]) continue;  // already awarded
            const threshold = ms.startAt + ms.step * (lvl - 1);
            const tier = _milestoneTierFromLevel(lvl);
            const ref = db.collection("users").doc(uid).collection("milestones").doc(levelId);
            milestoneBatch.set(ref, { level: lvl, threshold, tier, awardedAt: now, metric: ms.metric, value: currentValue, backfilled: true });
            hasMilestoneBatch = true;
            milestonesAwarded++;
          }

          // Update root milestone doc
          const rootRef = db.collection("users").doc(uid).collection("milestones").doc(ms.id);
          milestoneBatch.set(rootRef, { level: newLevel, awardedAt: new Date().toISOString(), backfilled: true }, { merge: true });
          hasMilestoneBatch = true;
        }

        if (hasMilestoneBatch) await milestoneBatch.commit();

      } catch (e) {
        console.warn(`[backfill] uid=${uid} email=${userData.email} error:`, e.message || e);
        errors++;
      }

      processed++;
      if (processed % 10 === 0) {
        console.log(`[backfill] progress: ${processed} / ${totalUsers} users processed`);
      }
    }

    // ── 5. Update global trophy counts ────────────────────────────────────────
    if (Object.keys(trophyCounts).length > 0) {
      const countsUpdate = {};
      Object.entries(trophyCounts).forEach(([id, count]) => {
        countsUpdate["counts." + id] = admin.firestore.FieldValue.increment(count);
      });
      await db.collection("_meta").doc("trophyStats").update(countsUpdate).catch(() => {});
    }

    console.log(`[backfill] DONE: processed=${processed} trophiesAwarded=${trophiesAwarded} milestonesAwarded=${milestonesAwarded} errors=${errors}`);
    return { ok: true, processed, trophiesAwarded, milestonesAwarded, errors, trophyCounts };
  }
);
