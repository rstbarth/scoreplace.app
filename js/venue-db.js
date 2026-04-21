// ========================================
// scoreplace.app — Venue Database Module
// ========================================
// CRUD for the `venues` collection. A venue represents a physical place
// where people play — gym, clube, quadra, etc. Can be:
//   - Claimed: ownerUid set → the proprietor manages the listing.
//   - Community: no ownerUid → just a reference (tournament venues that
//     nobody has claimed yet). Not created via this module in B1.
//
// Doc id = stable venue key:
//   - If Google Places placeId, use it directly.
//   - Else a slug 'custom:<slug>' — same scheme PresenceDB.venueKey uses,
//     so a venue and its presences share the same key.
//
// Schema:
//   placeId, name, address, city, lat, lon
//   sports: [string]           — normalized sport labels offered
//   courtCount: number         — how many courts/tables
//   courtType: string          — e.g. "areia + coberta"
//   priceRange: '$'|'$$'|'$$$' — rough hourly rate bucket
//   hours: string              — free-text schedule (structured later)
//   contact: { phone, whatsapp, email, instagram }
//   description: string        — short pitch
//   ownerUid, ownerEmail       — claim fields
//   verified: boolean          — admin-gated (manual for now)
//   plan: 'free' | 'pro'
//   createdAt, updatedAt, claimedAt

window.VenueDB = {
  get db() { return window.FirestoreDB && window.FirestoreDB.db; },

  // Reuse the presence venueKey helper so the two collections share IDs.
  venueKey: function(placeId, name) {
    if (window.PresenceDB && typeof window.PresenceDB.venueKey === 'function') {
      return window.PresenceDB.venueKey(placeId, name);
    }
    if (placeId) return String(placeId).trim();
    var slug = String(name || '').trim().toLowerCase()
      .replace(/[^a-z0-9\u00C0-\u024F]+/gu, '-').replace(/^-+|-+$/g, '');
    return slug ? 'custom:' + slug : '';
  },

  async loadVenue(key) {
    if (!this.db || !key) return null;
    try {
      var doc = await this.db.collection('venues').doc(key).get();
      return doc.exists ? Object.assign({}, doc.data(), { _id: doc.id }) : null;
    } catch (e) {
      console.error('Erro ao carregar venue:', e);
      return null;
    }
  },

  // Claim a venue via transaction to prevent two people grabbing the same
  // placeId at once. If already claimed by somebody else → throw.
  async claimVenue(key, data) {
    if (!this.db || !key) throw new Error('key obrigatória');
    var self = this;
    var ref = this.db.collection('venues').doc(key);
    return this.db.runTransaction(async function(tx) {
      var doc = await tx.get(ref);
      var now = Date.now();
      var base = doc.exists ? doc.data() : {};
      if (base.ownerUid && base.ownerUid !== data.ownerUid) {
        throw new Error('venue-já-reivindicado');
      }
      var clean = window.FirestoreDB._cleanUndefined(Object.assign({}, base, data, {
        placeId: key,
        claimedAt: base.claimedAt || now,
        updatedAt: now,
        createdAt: base.createdAt || now,
        plan: base.plan || 'free',
        verified: base.verified || false
      }));
      tx.set(ref, clean, { merge: true });
      return clean;
    });
  },

  // Update a venue — only the owner can call this (enforced by rules).
  async updateVenue(key, updates) {
    if (!this.db || !key) return false;
    try {
      var clean = window.FirestoreDB._cleanUndefined(updates);
      clean.updatedAt = Date.now();
      await this.db.collection('venues').doc(key).update(clean);
      return true;
    } catch (e) {
      console.error('Erro ao atualizar venue:', e);
      return false;
    }
  },

  // Release ownership without deleting the doc so its presences/tournaments
  // don't lose the reference. Owner becomes null → reverts to community listing.
  async releaseVenue(key) {
    if (!this.db || !key) return false;
    try {
      await this.db.collection('venues').doc(key).update({
        ownerUid: null,
        ownerEmail: null,
        releasedAt: Date.now(),
        updatedAt: Date.now()
      });
      return true;
    } catch (e) {
      console.error('Erro ao liberar venue:', e);
      return false;
    }
  },

  // Paginated list for the public discovery view. Only one server-side
  // inequality/array-contains is allowed per query, so we pick the most
  // selective filter for the server and apply the rest client-side on the
  // returned page. Precedence: sport (array-contains) > city (equality) >
  // no filter. Results sorted by name alphabetically.
  async listVenues(filters, opts) {
    if (!this.db) return [];
    filters = filters || {};
    opts = opts || {};
    var limit = Math.max(1, Math.min(100, opts.limit || 50));
    var ref = this.db.collection('venues');
    var q;
    try {
      if (filters.sport) {
        q = ref.where('sports', 'array-contains', filters.sport).limit(limit);
      } else if (filters.city) {
        // Normalize for match — we store the raw city. Equality with exact
        // case match would miss "são paulo" vs "São Paulo"; keep a loose
        // client-side filter instead of requiring a lowercased denorm field
        // for this first iteration.
        q = ref.limit(limit);
      } else {
        q = ref.limit(limit);
      }
      var snap = await q.get();
      var list = [];
      snap.forEach(function(doc) {
        var d = doc.data();
        d._id = doc.id;
        list.push(d);
      });
      // Client-side filters for the parts we couldn't push to the server.
      var cityQ = (filters.city || '').trim().toLowerCase();
      var priceQ = filters.priceRange || '';
      var minCourts = parseInt(filters.minCourts, 10) || 0;
      return list.filter(function(v) {
        if (cityQ && !(v.city || '').toLowerCase().includes(cityQ)) return false;
        if (priceQ && v.priceRange !== priceQ) return false;
        if (minCourts > 0 && (!v.courtCount || v.courtCount < minCourts)) return false;
        return true;
      }).sort(function(a, b) {
        // Pro always ranks above Free; within a tier, verified first, then name.
        var ap = a.plan === 'pro' ? 1 : 0;
        var bp = b.plan === 'pro' ? 1 : 0;
        if (ap !== bp) return bp - ap;
        var av = a.verified ? 1 : 0;
        var bv = b.verified ? 1 : 0;
        if (av !== bv) return bv - av;
        return (a.name || '').localeCompare(b.name || '');
      });
    } catch (e) {
      console.error('Erro ao listar venues:', e);
      return [];
    }
  },

  // Atomic increment of the viewCount field using server-side FieldValue.
  // Called each time the detail modal opens (except for the owner, so the
  // owner's own curiosity doesn't inflate numbers). Write-only from client;
  // no reads needed. Small cost even at scale.
  async incrementViewCount(key) {
    if (!this.db || !key) return;
    try {
      await this.db.collection('venues').doc(key).update({
        viewCount: firebase.firestore.FieldValue.increment(1),
        lastViewedAt: Date.now()
      });
    } catch (e) {
      // Doc might not allow writes from visitor (rules: owner-only update).
      // That's expected — only owner-related writes will succeed in firestore.
      // For a permissive counter we'd relax rules; doing so lands in B5 proper.
    }
  },

  async loadMyVenues(uid) {
    if (!this.db || !uid) return [];
    try {
      var snap = await this.db.collection('venues')
        .where('ownerUid', '==', uid).get();
      var list = [];
      snap.forEach(function(doc) {
        var d = doc.data();
        d._id = doc.id;
        list.push(d);
      });
      list.sort(function(a, b) { return (a.name || '').localeCompare(b.name || ''); });
      return list;
    } catch (e) {
      console.error('Erro ao carregar meus venues:', e);
      return [];
    }
  }
};
