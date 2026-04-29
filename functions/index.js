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
const admin = require("firebase-admin");

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
