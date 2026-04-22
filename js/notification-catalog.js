// ========================================
// scoreplace.app — Notification Event Catalog
// Single source of truth: event_type → {level, icon, color}
// ========================================

window.NOTIF_CATALOG = {
  // Enrollment events
  enrollment_new:              { level: 'all',         icon: '✅', color: 'var(--success-color)' },
  enrollment_confirm:          { level: 'all',         icon: '🎉', color: 'var(--success-color)' },
  enrollment_cancelled:        { level: 'important',   icon: '🛑', color: 'var(--danger-color, #ef4444)' },
  enrollment_cancelled_confirm:{ level: 'important',   icon: '🛑', color: 'var(--danger-color, #ef4444)' },
  enrollments_closed:          { level: 'important',   icon: '🔒', color: '#f59e0b' },
  enrollments_reopened:        { level: 'important',   icon: '🔓', color: 'var(--success-color)' },

  // Tournament lifecycle
  tournament_created:          { level: 'all',         icon: '🏆', color: 'var(--primary-color)' },
  tournament_deleted:          { level: 'fundamental', icon: '🗑️', color: 'var(--danger-color, #ef4444)' },
  tournament_update:           { level: 'important',   icon: '📢', color: '#f59e0b' },
  // Alias — create-tournament.js dispara com 'tournament_updated' (forma verbal
  // passada) em vez de 'tournament_update'. Mantemos as duas chaves pra não
  // quebrar notificações já persistidas em Firestore.
  tournament_updated:          { level: 'important',   icon: '📢', color: '#f59e0b' },
  tournament_finished:         { level: 'important',   icon: '🏆', color: '#a78bfa' },
  tournament_invite:           { level: 'all',         icon: '🏆', color: 'var(--primary-color)' },

  // Draw / rounds
  draw:                        { level: 'important',   icon: '🎲', color: 'var(--primary-color)' },
  new_round:                   { level: 'important',   icon: '🔄', color: 'var(--primary-color)' },

  // Match events
  result:                      { level: 'fundamental', icon: '🏅', color: '#a78bfa' },

  // Reminders
  tournament_reminder:         { level: 'important',   icon: '⏰', color: '#f59e0b' },
  tournament_nearby:           { level: 'all',         icon: '📍', color: 'var(--primary-color)' },

  // Organizer actions
  org_communication:           { level: 'important',   icon: '📣', color: '#f59e0b' },
  // Alias — tournaments-organizer.js dispara com 'organizer_communication'.
  // Ambas as chaves apontam pro mesmo ícone/cor; resolve o fallback genérico
  // 🔔 que estava aparecendo no inbox.
  organizer_communication:     { level: 'important',   icon: '📣', color: '#f59e0b' },
  participant_removed:         { level: 'fundamental', icon: '🚫', color: 'var(--danger-color, #ef4444)' },

  // Host/cohost
  cohost_invite:               { level: 'fundamental', icon: '👑', color: '#fbbf24' },
  host_transfer_invite:        { level: 'fundamental', icon: '👑', color: '#fbbf24' },
  cohost_invite_sent:          { level: 'all',         icon: '📨', color: '#fbbf24' },
  host_transfer_sent:          { level: 'all',         icon: '📨', color: '#fbbf24' },
  host_invite_accepted:        { level: 'important',   icon: '✅', color: 'var(--success-color)' },
  host_invite_rejected:        { level: 'important',   icon: '❌', color: 'var(--danger-color, #ef4444)' },
  cohost_removed:              { level: 'important',   icon: '🚫', color: 'var(--danger-color, #ef4444)' },

  // Social
  friend_request:              { level: 'all',         icon: '👋', color: '#f59e0b' },
  friend_accepted:             { level: 'all',         icon: '🤝', color: 'var(--success-color)' },

  // Polls
  poll:                        { level: 'important',   icon: '🗳️', color: 'var(--primary-color)' },

  // Category
  category_assignment:         { level: 'all',         icon: '🏷️', color: 'var(--primary-color)' },

  // Presence (disparada por _notifyFriendsOfPlan quando amigo planeja ida
  // num local — v0.14.70). Antes caía no fallback 🔔 porque não havia
  // entrada no catálogo; agora exibe com ícone de calendário verde.
  presence_plan:               { level: 'all',         icon: '🗓️', color: 'var(--success-color)' }
};
