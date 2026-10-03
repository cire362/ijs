import type { RouteLocationRaw } from 'vue-router'
import type { AppNotification, Role } from '@/api/types'

// Where a click on a notification leads, by type and the reader's role.
export function notificationLink (note: AppNotification, role: Role | null): RouteLocationRaw | null {
  const meta = note.meta ?? {}
  const applicationId = Number(meta.applicationId) || null
  const eventId = Number(meta.eventId) || null
  const manager = role === 'developer' || role === 'admin'
  switch (note.type) {
    case 'application_new':
    case 'application_status':
    case 'application_extended':
      if (!applicationId) return manager ? '/incoming' : '/applications'
      return { path: manager ? '/incoming' : '/applications', query: { app: String(applicationId) } }
    case 'application_chat_message':
      return applicationId ? { path: '/application-chats', query: { appId: String(applicationId) } } : '/application-chats'
    case 'developer_registration':
      return '/admin/developers'
    case 'developer_status':
      return '/profile'
    case 'event_registration':
    case 'event_registration_cancelled':
      return eventId ? { path: '/admin/events', query: { event: String(eventId) } } : '/admin/events'
    case 'event_registration_status':
    case 'event_reminder':
    case 'event_updated':
    case 'event_cancelled':
      return '/events'
    default:
      return null
  }
}
