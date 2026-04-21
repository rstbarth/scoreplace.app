// ========================================
// scoreplace.app — Presence Database Module
// ========================================
// CRUD for the `presences` collection.
// A presence = "I'm at (or will be at) venue X playing sport Y on day Z".
//
// Data model per presence doc:
//   uid, email_lower, displayName, photoURL
//   placeId        — Google Places place_id OR 'custom:<slug>' for free-typed venues
//   venueName, venueLat, venueLon (optional)
//   sport          — normalized sport name (no emoji prefix)
//   type           — 'checkin' | 'planned'
//   startsAt       — ms since epoch (checkin: now; planned: user-chosen)
//   endsAt         — ms since epoch (checkin: now + 4h; planned: user-chosen)
//   dayKey         — 'YYYY-MM-DD' in local TZ of startsAt (for cheap queries)
//   visibility     — 'friends' | 'public'
//   cancelled      — boolean (soft delete; queries filter it out)
//   createdAt      — ms since epoch
//
// Queries are composite: (placeId, sport, dayKey). Firestore auto-suggests the
// index link on first run.

window.PresenceDB = {
  get db() { return window.FirestoreDB && window.FirestoreDB.db; },

  CHECKIN_WINDOW_MS: 4 * 60 * 60 * 1000, // 4 hours

  // Format a Date as local YYYY-MM-DD.
  dayKey(date) {
    var d = date || new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var dd = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + dd;
  },

  // Normalize a sport label: strip leading emojis / punctuation so stored
  // values match across UIs. "🎾 Beach Tennis" -> "Beach Tennis".
  normalizeSport(s) {
    if (!s) return '';
    return String(s).replace(/^[^\w\u00C0-\u024F]+/u, '').trim();
  },

  // Produce a stable venue key — Google placeId if available, otherwise a
  // slugged version of the free-typed venue name. Guarantees users typing
  // "Clube X" and "clube x" land on the same bucket.
  venueKey(placeId, venueName) {
    if (placeId && String(placeId).trim()) return String(placeId).trim();
    var slug = String(venueName || '').trim().toLowerCase()
      .replace(/[^a-z0-9\u00C0-\u024F]+/gu, '-')
      .replace(/^-+|-+$/g, '');
    return slug ? 'custom:' + slug : '';
  },

  // Create a check-in (now → now + window) or planned presence.
  async savePresence(data) {
    if (!this.db) throw new Error('Firestore not initialized');
    var clean = window.FirestoreDB._cleanUndefined(data);
    clean.createdAt = clean.createdAt || Date.now();
    if (!clean.dayKey) clean.dayKey = this.dayKey(new Date(clean.startsAt || Date.now()));
    var ref = await this.db.collection('presences').add(clean);
    return ref.id;
  },

  // Soft-cancel own presence.
  async cancelPresence(docId) {
    if (!this.db || !docId) return false;
    try {
      await this.db.collection('presences').doc(docId).update({ cancelled: true, cancelledAt: Date.now() });
      return true;
    } catch (e) {
      console.error('Erro ao cancelar presença:', e);
      return false;
    }
  },

  // Load all presences for a given venue + sport on a given local day.
  // Matches on the multi-sport `sports[]` array (one presence can cover
  // several modalities) via array-contains. Older docs that still have only
  // the legacy `sport` scalar are also fetched and merged so we don't miss
  // anything during the alpha transition. Dedup by doc id. Returns list with
  // `_id`. Visibility/friend filtering is the caller's job.
  async loadForVenueSportDay(placeId, sport, dayKey) {
    if (!this.db || !placeId || !sport || !dayKey) return [];
    var normSport = this.normalizeSport(sport);
    try {
      var results = {};
      var addFromSnap = function(snap) {
        snap.forEach(function(doc) {
          if (results[doc.id]) return;
          var d = doc.data();
          if (d && !d.cancelled) {
            d._id = doc.id;
            results[doc.id] = d;
          }
        });
      };
      await Promise.all([
        this.db.collection('presences')
          .where('placeId', '==', placeId)
          .where('sports', 'array-contains', normSport)
          .where('dayKey', '==', dayKey)
          .get().then(addFromSnap).catch(function(e) { console.warn('sports[] query:', e && e.message); }),
        this.db.collection('presences')
          .where('placeId', '==', placeId)
          .where('sport', '==', normSport)
          .where('dayKey', '==', dayKey)
          .get().then(addFromSnap).catch(function(e) { console.warn('sport query:', e && e.message); })
      ]);
      return Object.keys(results).map(function(k) { return results[k]; });
    } catch (e) {
      console.error('Erro ao carregar presenças:', e);
      return [];
    }
  },

  // Load ALL presences at a venue on a given day — across every sport.
  // Used by the venue detail modal to show total movement without the user
  // having to pick a modality first. Requires composite index (placeId asc,
  // dayKey asc); Firestore will surface a one-click creation link on the
  // first query if it's missing.
  async loadForVenueDay(placeId, dayKey) {
    if (!this.db || !placeId || !dayKey) return [];
    try {
      var snap = await this.db.collection('presences')
        .where('placeId', '==', placeId)
        .where('dayKey', '==', dayKey)
        .get();
      var list = [];
      snap.forEach(function(doc) {
        var d = doc.data();
        if (d && !d.cancelled) {
          d._id = doc.id;
          list.push(d);
        }
      });
      return list;
    } catch (e) {
      console.error('Erro ao carregar presenças do venue:', e);
      return [];
    }
  },

  // Load a single user's own active presences (check-in still running OR any
  // planned presence in the future). Used by dashboard to show "you're checked
  // in at X" and by the presence view to avoid duplicate check-ins.
  async loadMyActive(uid) {
    if (!this.db || !uid) return [];
    try {
      var now = Date.now();
      var snap = await this.db.collection('presences')
        .where('uid', '==', uid)
        .where('endsAt', '>', now)
        .get();
      var list = [];
      snap.forEach(function(doc) {
        var d = doc.data();
        if (d && !d.cancelled) {
          d._id = doc.id;
          list.push(d);
        }
      });
      return list;
    } catch (e) {
      console.error('Erro ao carregar presenças próprias:', e);
      return [];
    }
  },

  // Load presences from a set of uids (friends feed). Chunked in groups of 10
  // to stay within Firestore's `in` operator limit. Filters to currently-active
  // or upcoming presences within the next 48h.
  async loadForFriends(uids, windowMs) {
    if (!this.db || !Array.isArray(uids) || uids.length === 0) return [];
    var win = windowMs || (48 * 60 * 60 * 1000);
    var now = Date.now();
    var horizon = now + win;
    var chunks = [];
    for (var i = 0; i < uids.length; i += 10) chunks.push(uids.slice(i, i + 10));
    var all = [];
    try {
      for (var c = 0; c < chunks.length; c++) {
        var snap = await this.db.collection('presences')
          .where('uid', 'in', chunks[c])
          .where('endsAt', '>', now)
          .get();
        snap.forEach(function(doc) {
          var d = doc.data();
          if (!d || d.cancelled) return;
          if (d.startsAt && d.startsAt > horizon) return;
          d._id = doc.id;
          all.push(d);
        });
      }
      return all;
    } catch (e) {
      console.error('Erro ao carregar presenças de amigos:', e);
      return [];
    }
  }
};
