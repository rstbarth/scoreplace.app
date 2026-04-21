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
