import { describe, expect, test } from 'vitest'
import type { AppNotification } from '@/api/types'
import { notificationLink } from './notificationLink'

const note = (type: string, meta: Record<string, unknown>): AppNotification => ({ id: 1, userId: 1, type, key: null, text: '', isRead: false, meta, createdAt: '' })

describe('notification links', () => {
  test('application notifications open the list of the reader with the application selected', () => {
    expect(notificationLink(note('application_status', { applicationId: 7 }), 'agent')).toEqual({ path: '/applications', query: { app: '7' } })
    expect(notificationLink(note('application_status', { applicationId: 7 }), 'developer')).toEqual({ path: '/incoming', query: { app: '7' } })
    expect(notificationLink(note('application_chat_message', { applicationId: 7 }), 'admin')).toEqual({ path: '/application-chats', query: { appId: '7' } })
  })

  test('event and account notifications lead to their screens', () => {
    expect(notificationLink(note('event_cancelled', { eventId: 3 }), 'agent')).toBe('/events')
    expect(notificationLink(note('event_registration_cancelled', { eventId: 3 }), 'admin')).toEqual({ path: '/admin/events', query: { event: '3' } })
    expect(notificationLink(note('developer_status', {}), 'developer')).toBe('/profile')
    expect(notificationLink(note('unknown', {}), 'agent')).toBeNull()
  })
})
