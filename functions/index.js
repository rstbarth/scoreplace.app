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
const { onRequest } = require("firebase-functions/v2/https");
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

// ─── HTTP endpoint: remoteScore ──────────────────────────────────────────────
// Entry point for Apple Shortcuts (or any HTTP client) to mutate a live match
// score. The caller presents a session token created client-side via
// `remoteSessions/{token}` in Firestore. The function:
//
//   1) Loads the session doc (direct by ID — O(1), no listing needed).
//   2) Verifies expiry.
//   3) Loads the target tournament.
//   4) Cross-checks the session's stored email against tournament.adminEmails
//      — guards against a leaked old session being used after the organizer
//      lost admin rights.
//   5) Applies the requested action in-place on the match object and writes
//      the tournament back via set(..., {merge:true}).
//
// Never trust client input for uid/email derivation — we require the token
// itself, which is the document ID, created under rules that bind uid+email
// to the caller's auth context.
//
// CORS is enabled for browser-side manual testing; the primary caller is
// Shortcuts which doesn't care. No rate-limit yet — acceptable because the
// token expires in 24h and a single organizer typing on a watch is not a
// hot path.
exports.remoteScore = onRequest(
  { region: "us-central1", cors: true },
  async (req, res) => {
    if (req.method === "GET" && req.query.ping === "1") {
      res.json({ ok: true, service: "scoreplace.remoteScore", ts: Date.now() });
      return;
    }
    if (req.method !== "POST") {
      res.status(405).json({ error: "Use POST with JSON body." });
      return;
    }
    try {
      const body = req.body || {};
      const token = String(body.token || "").trim();
      const action = String(body.action || "").trim();
      if (!token || !action) {
        res.status(400).json({ error: "Missing 'token' or 'action' in JSON body." });
        return;
      }

      const db = admin.firestore();
      const sessRef = db.collection("remoteSessions").doc(token);
      const sessSnap = await sessRef.get();
      if (!sessSnap.exists) {
        res.status(401).json({ error: "Invalid or revoked token." });
        return;
      }
      const sess = sessSnap.data();
      if (sess.expiresAt && new Date(sess.expiresAt).getTime() < Date.now()) {
        res.status(401).json({ error: "Token expired. Generate a new one from the web app." });
        return;
      }

      // Branch: tournament session vs casual session.
      if (sess.casualMatchId) {
        return await _handleCasualAction(db, sess, action, body, res);
      }

      if (!sess.tournamentId) {
        res.status(400).json({ error: "Session has no tournamentId or casualMatchId." });
        return;
      }

      // `status` action returns current active match info without mutating.
      // Useful as the first step in a Shortcut chain ("tell me the score").
      const tRef = db.collection("tournaments").doc(String(sess.tournamentId));
      const tSnap = await tRef.get();
      if (!tSnap.exists) {
        res.status(404).json({ error: "Tournament not found." });
        return;
      }
      const t = tSnap.data();

      // Admin re-check: the session stored the caller's email at creation; we
      // verify it's still an admin of the tournament. Revokes via removeCoHost
      // etc. take effect immediately.
      const sessEmail = (sess.email || "").toLowerCase();
      const adminEmails = Array.isArray(t.adminEmails) ? t.adminEmails.map((e) => String(e || "").toLowerCase()) : [];
      if (!sessEmail || adminEmails.indexOf(sessEmail) === -1) {
        res.status(403).json({ error: "Caller is no longer an admin of this tournament." });
        return;
      }

      if (!sess.currentMatchId) {
        res.status(400).json({ error: "No active match set. Open the tournament in the app and pick a match first." });
        return;
      }

      const match = _findMatchInTournament(t, sess.currentMatchId);
      if (!match) {
        res.status(404).json({ error: "Active match no longer exists." });
        return;
      }
      const m = match;

      // ── Actions ─────────────────────────────────────────────────────────
      let modified = true;
      if (action === "status") {
        modified = false;
      } else if (action === "inc_p1") {
        m.scoreP1 = (Number(m.scoreP1) || 0) + 1;
      } else if (action === "inc_p2") {
        m.scoreP2 = (Number(m.scoreP2) || 0) + 1;
      } else if (action === "dec_p1") {
        m.scoreP1 = Math.max(0, (Number(m.scoreP1) || 0) - 1);
      } else if (action === "dec_p2") {
        m.scoreP2 = Math.max(0, (Number(m.scoreP2) || 0) - 1);
      } else if (action === "set_score") {
        const p1 = parseInt(body.p1, 10);
        const p2 = parseInt(body.p2, 10);
        if (isNaN(p1) || isNaN(p2) || p1 < 0 || p2 < 0) {
          res.status(400).json({ error: "set_score requires numeric 'p1' and 'p2' >= 0." });
          return;
        }
        m.scoreP1 = p1;
        m.scoreP2 = p2;
      } else if (action === "finalize") {
        const p1 = Number(m.scoreP1) || 0;
        const p2 = Number(m.scoreP2) || 0;
        if (p1 === p2) {
          // Drawing is format-dependent. For safety we don't auto-finalize ties
          // via the remote — the organizer can edit on web if needed.
          res.status(400).json({ error: "Cannot finalize a tie via remote. Edit on web." });
          return;
        }
        m.winner = p1 > p2 ? m.p1 : m.p2;
        m.draw = false;
        m.finalizedViaRemote = true;
      } else {
        res.status(400).json({ error: "Unknown action: " + action });
        return;
      }

      if (modified) {
        m.updatedAt = new Date().toISOString();
        m.updatedByRemote = true;
        await tRef.set(t, { merge: true });
      }

      const p1Name = m.p1 || "J1";
      const p2Name = m.p2 || "J2";
      const s1 = Number(m.scoreP1) || 0;
      const s2 = Number(m.scoreP2) || 0;
      res.json({
        ok: true,
        action: action,
        matchId: sess.currentMatchId,
        p1: p1Name,
        p2: p2Name,
        scoreP1: s1,
        scoreP2: s2,
        winner: m.winner || null,
        summary: p1Name + " " + s1 + " × " + s2 + " " + p2Name,
        spoken: s1 + " a " + s2,
      });
    } catch (err) {
      console.error("[remoteScore]", err);
      res.status(500).json({ error: "Internal error", detail: String(err.message || err) });
    }
  }
);

// Match lookup — searches every structure the web app persists matches in.
// Returns the first hit by id, or null. Keep in sync with js/remote-control.js
// _findMatchInTournament.
function _findMatchInTournament(t, matchId) {
  const id = String(matchId);
  function pick(arr) {
    if (!Array.isArray(arr)) return null;
    return arr.find((m) => String(m.id) === id) || null;
  }
  let m = pick(t.matches);
  if (m) return m;
  if (Array.isArray(t.rounds)) {
    for (const r of t.rounds) {
      m = pick(r.matches);
      if (m) return m;
    }
  }
  if (Array.isArray(t.groups)) {
    for (const g of t.groups) {
      m = pick(g.matches);
      if (m) return m;
    }
  }
  if (Array.isArray(t.rodadas)) {
    for (const r of t.rodadas) {
      m = pick(r.matches);
      if (m) return m;
    }
  }
  if (t.thirdPlaceMatch && String(t.thirdPlaceMatch.id) === id) {
    return t.thirdPlaceMatch;
  }
  return null;
}

// ─── Casual match handler ───────────────────────────────────────────────────
// Casual matches have a fully-featured live scoring engine on the client
// (deuce, tiebreak, super-tiebreak, set/match transitions, etc.). Rather than
// replicate that state machine server-side — and risk it drifting — we queue
// a pending action onto the casual match doc. The web client, which holds an
// `onSnapshot` listener on the doc, picks it up, calls `_liveScorePoint(team)`
// (or `_closeLiveScoring()` for `finish`), and clears the queue.
//
// Trade-off: requires the organizer's phone/tablet to have the live scoring
// overlay open. If it's closed, actions pile up in `pendingRemoteActions[]`
// and apply catch-up style when the overlay is next opened.
//
// Auth check: the session is bound to a uid by creation. The casual match
// doc stores `createdBy` (uid) — we require session uid == createdBy so only
// the match creator (= the organizer at the arena) can control it via watch.
async function _handleCasualAction(db, sess, action, body, res) {
  const casualId = String(sess.casualMatchId);
  const matchRef = db.collection("casualMatches").doc(casualId);
  const matchSnap = await matchRef.get();
  if (!matchSnap.exists) {
    res.status(404).json({ error: "Casual match not found." });
    return;
  }
  const match = matchSnap.data();

  // Only the match creator can drive scoring via remote. Prevents a leaked
  // token from one session bleeding into a casual match the user is merely
  // a participant in.
  if (!match.createdBy || String(match.createdBy) !== String(sess.uid)) {
    res.status(403).json({ error: "Only the match creator can control this casual match via remote." });
    return;
  }

  // Match already ended — block further score changes. Watch Shortcut should
  // show the error or just silently no-op.
  if (match.status === "finished") {
    res.status(409).json({ error: "Casual match already finished." });
    return;
  }

  // Compute current summary from liveState (may be absent if the match hasn't
  // started). All downstream responses include this so the Watch can "Falar
  // texto" the score.
  const summary = _summarizeCasualState(match);

  if (action === "status") {
    res.json({
      ok: true,
      action: "status",
      casualMatchId: casualId,
      ...summary,
    });
    return;
  }

  // Whitelist: the set of actions the web client knows how to apply. Anything
  // outside this set is rejected — keeps the contract explicit.
  const ALLOWED = ["point_team1", "point_team2", "finish"];
  if (ALLOWED.indexOf(action) === -1) {
    res.status(400).json({ error: "Unknown casual action: " + action });
    return;
  }

  // Write a pending action. We use an array so rapid taps aren't lost if the
  // client is processing one and a second arrives. Nonce lets the client
  // dedupe in case the same snapshot fires twice.
  const nonce = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const pendingAction = {
    action: action,
    nonce: nonce,
    uid: sess.uid,
    ts: Date.now(),
  };

  // Atomic append via FieldValue.arrayUnion-style transaction so concurrent
  // taps don't stomp each other.
  await db.runTransaction(async (tx) => {
    const fresh = await tx.get(matchRef);
    if (!fresh.exists) throw new Error("Match vanished mid-transaction");
    const data = fresh.data();
    const queue = Array.isArray(data.pendingRemoteActions) ? data.pendingRemoteActions.slice() : [];
    queue.push(pendingAction);
    // Cap the queue at 20 to bound memory if the client is offline for a
    // long time and the organizer keeps tapping.
    const capped = queue.slice(-20);
    tx.update(matchRef, {
      pendingRemoteActions: capped,
      pendingRemoteActionsUpdatedAt: new Date().toISOString(),
    });
  });

  res.json({
    ok: true,
    action: action,
    casualMatchId: casualId,
    queued: true,
    nonce: nonce,
    note: "Action queued. Keep the live scoring screen open on the phone so the engine applies it.",
    ...summary,
  });
}

// Pulls the current score summary from a casual match's liveState. Returns
// flat fields (summary, spoken, p1, p2, etc.) so the Shortcut can pass any
// of them straight to "Falar texto". Defensive against missing liveState
// (match hasn't started or schema drift).
function _summarizeCasualState(match) {
  const live = match.liveState || {};
  const sets = Array.isArray(live.sets) ? live.sets : [];
  const sportName = match.sport || "";
  const isDoubles = !!match.isDoubles;

  // Try to read player names from multiple possible slots. Singles often
  // store direct `p1Name` / `p2Name`; doubles use `teamNames` arrays or the
  // `players` slot list. We render as plain names for the spoken response.
  let p1 = match.p1Name || (Array.isArray(match.teamNames) ? match.teamNames[0] : "") || "Time 1";
  let p2 = match.p2Name || (Array.isArray(match.teamNames) ? match.teamNames[1] : "") || "Time 2";
  if (isDoubles && Array.isArray(match.players) && match.players.length >= 4) {
    const names = match.players.map((p) => (p && p.displayName) || "").filter((n) => n);
    if (names.length >= 2) p1 = names.slice(0, 2).join(" / ") || p1;
    if (names.length >= 4) p2 = names.slice(2, 4).join(" / ") || p2;
  }

  // Build a "6-4 3-6" style string from completed sets.
  const setsStr = sets
    .map((s) => (Number(s.gamesP1) || 0) + "-" + (Number(s.gamesP2) || 0))
    .join(" ");
  const cur1 = Number(live.currentGameP1) || 0;
  const cur2 = Number(live.currentGameP2) || 0;
  const currentStr = cur1 + "-" + cur2;
  const inMatch = setsStr && setsStr.length > 0;

  let summary, spoken;
  if (live.isFinished) {
    const winnerLabel = live.winner === 1 ? p1 : (live.winner === 2 ? p2 : "empate");
    summary = "Final: " + p1 + " " + setsStr + " " + p2 + " — " + winnerLabel;
    spoken = "Partida encerrada. " + winnerLabel + " venceu.";
  } else if (inMatch) {
    summary = p1 + " " + setsStr + " " + p2 + " (game atual " + currentStr + ")";
    spoken = "Placar: " + setsStr + ". Game atual " + currentStr + ".";
  } else {
    summary = p1 + " vs " + p2 + " — game atual " + currentStr;
    spoken = currentStr;
  }

  return {
    p1: p1,
    p2: p2,
    sport: sportName,
    setsStr: setsStr,
    currentStr: currentStr,
    isFinished: !!live.isFinished,
    winner: live.winner || null,
    summary: summary,
    spoken: spoken,
  };
}
