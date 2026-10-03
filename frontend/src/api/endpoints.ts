import { http, csrfHeaders } from './http'
import type {
  AddressSuggestion, Application, ApplicationChatMessage, ApplicationChatSummary, ApplicationStatus,
  AppNotification, AuditEntry, EventRegistration, NewsItem, Page, PlatformEvent, Property,
  RegistrationStatus, SaleStatus, SupportChatSummary, SupportMessage, TariffCategory, TariffRate,
  TariffView, User
} from './types'

type Query = Record<string, string | number | boolean | null | undefined>

function clean (query: Query = {}) {
  return Object.fromEntries(Object.entries(query).filter(([, value]) => value !== '' && value != null))
}
async function get<T> (url: string, params?: Query) {
  return (await http.get<T>(url, { params: clean(params) })).data
}
async function send<T> (method: 'post' | 'patch' | 'put' | 'delete', url: string, body?: unknown) {
  return (await http.request<T>({ method, url, data: body })).data
}
function form (fields: Record<string, Blob | string>) {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) data.append(key, value)
  return data
}
function files (field: string, list: File[]) {
  const data = new FormData()
  for (const file of list) data.append(field, file)
  return data
}

export interface ConsentPayload {
  legal: { accepted: true, acceptedAt: string, documentVersion: string, termsPath: string, privacyPath: string }
  marketing: { accepted: boolean, acceptedAt: string | null, documentVersion: string | null }
}

export interface RegisterPayload {
  email: string
  password: string
  role: 'agent' | 'individual' | 'developer'
  phone: string
  firstName?: string
  lastName?: string
  middleName?: string
  companyName?: string
  consent: ConsentPayload
}

export const authApi = {
  login: (email: string, password: string) => send<{ token: string, user: User }>('post', '/auth/login', { email, password }),
  register: (payload: RegisterPayload) => send<{ id: number }>('post', '/auth/register', payload),
  logout: async () => { await http.post('/auth/logout', null, { headers: csrfHeaders(), skipAuthRefresh: true }) },
  logoutAll: async () => { await http.post('/auth/logout-all', null, { headers: csrfHeaders(), skipAuthRefresh: true }) },
  forgotPassword: (email: string) => send<{ message: string }>('post', '/auth/password/forgot', { email }),
  resetPassword: (token: string, password: string) => send<{ message: string }>('post', '/auth/password/reset', { token, password })
}

export interface ProfilePatch {
  firstName?: string
  lastName?: string
  middleName?: string
  email?: string
  phone?: string
  companyName?: string
}

export interface DeveloperPayload {
  companyName: string
  email: string
  phone: string
  password: string
  firstName?: string
  lastName?: string
  middleName?: string
}

export const usersApi = {
  me: () => get<User>('/users/me'),
  updateMe: (patch: ProfilePatch) => send<User>('patch', '/users/me', patch),
  deleteMe: (password: string) => send<{ success: true }>('delete', '/users/me', { password }),
  uploadAvatar: (file: File) => send<User>('post', '/users/me/avatar', form({ avatar: file })),
  changePassword: (currentPassword: string, newPassword: string) => send('patch', '/users/me/password', { currentPassword, newPassword }),
  setMarketingConsent: (accepted: boolean, documentVersion: string) => send<User>('patch', '/users/me/consents/marketing', { accepted, documentVersion }),
  developers: (query: { q?: string, status?: 'pending' | 'approved' | 'rejected' | '' }) => get<User[]>('/users/developers', query),
  approveDeveloper: (id: number) => send<User>('patch', `/users/developers/${id}/approve`),
  rejectDeveloper: (id: number) => send<User>('patch', `/users/developers/${id}/reject`),
  deleteDeveloper: (id: number) => send('delete', `/users/developers/${id}`),
  createDeveloper: (payload: DeveloperPayload) => send<User>('post', '/users/developers', payload)
}

export interface PropertyFilters extends Query {
  q?: string
  region?: string
  city?: string
  status?: SaleStatus | ''
  rooms?: number | null
  floors?: number | null
  priceMin?: number | null
  priceMax?: number | null
  page?: number
  limit?: number
}

export type PropertyPayload = Partial<Omit<Property, 'id' | 'createdAt' | 'updatedAt' | 'developer' | 'images' | 'documents' | 'tariffRates' | 'price'>> & { price?: number | null }

export const propertiesApi = {
  list: (filters: PropertyFilters) => get<Page<Property>>('/properties', filters),
  get: (id: number) => get<Property>(`/properties/${id}`),
  create: (payload: PropertyPayload) => send<Property>('post', '/properties', payload),
  update: (id: number, payload: PropertyPayload) => send<Property>('patch', `/properties/${id}`, payload),
  remove: (id: number) => send('delete', `/properties/${id}`),
  addImages: (id: number, list: File[]) => send<Property>('post', `/properties/${id}/images`, files('images', list)),
  removeImage: (imageId: number) => send('delete', `/properties/images/${imageId}`),
  addDocument: (id: number, file: File) => send<Property>('post', `/properties/${id}/documents`, form({ document: file })),
  removeDocument: (documentId: number) => send('delete', `/properties/documents/${documentId}`)
}

export interface ApplicationListQuery extends Query {
  page?: number
  limit?: number
  status?: ApplicationStatus | ''
  developerId?: number | null
}

export const applicationsApi = {
  mine: (query: ApplicationListQuery) => get<Page<Application>>('/applications/mine', query),
  incoming: (query: ApplicationListQuery) => get<Page<Application>>('/applications/incoming', query),
  get: (id: number) => get<Application>(`/applications/${id}`),
  create: (payload: { propertyId: number, clientFullName?: string, clientPhone?: string, comment?: string }) =>
    send<Application>('post', '/applications', payload),
  updateClient: (id: number, clientFullName: string, clientPhone: string) =>
    send<Application>('patch', `/applications/${id}/client`, { clientFullName, clientPhone }),
  setStatus: (id: number, status: ApplicationStatus, comment?: string) =>
    send<Application>('patch', `/applications/${id}/status`, { status, comment: comment || undefined }),
  extend: (id: number, days: number) => send<Application>('patch', `/applications/${id}/extend`, { days }),
  cancel: (id: number, comment?: string) => send<Application>('patch', `/applications/${id}/cancel`, { comment: comment || undefined }),
  chats: (query: { page?: number, limit?: number } = {}) => get<ApplicationChatSummary[]>('/applications/chat/chats', query),
  messages: (id: number, query: { limit?: number, beforeId?: number, afterId?: number } = {}) =>
    get<ApplicationChatMessage[]>(`/applications/${id}/chat/messages`, query),
  sendMessage: (id: number, text: string, file?: File | null) => file
    ? send<ApplicationChatMessage>('post', `/applications/${id}/chat/messages`, form(text ? { text, document: file } : { document: file }))
    : send<ApplicationChatMessage>('post', `/applications/${id}/chat/messages`, { text })
}

export const notificationsApi = {
  list: (query: { page: number, limit: number, q?: string, type?: string, isRead?: boolean | null }) =>
    get<Page<AppNotification>>('/notifications', query),
  unreadCount: async () => (await get<{ count: number }>('/notifications/unread-count')).count,
  markRead: (id: number) => send<AppNotification>('post', `/notifications/${id}/read`),
  markAllRead: async () => (await send<{ count: number }>('post', '/notifications/read-all')).count
}

export interface EventPayload {
  title: string
  description?: string | null
  location?: string | null
  format?: string | null
  startAt: string
  endAt?: string | null
  capacity?: number | null
  isTraining?: boolean
}

export const eventsApi = {
  list: (query: { page?: number, limit?: number, q?: string, training?: boolean, period?: 'upcoming' | 'past' }) => get<Page<PlatformEvent>>('/events', query),
  create: (payload: EventPayload) => send<PlatformEvent>('post', '/events', payload),
  update: (id: number, payload: Partial<EventPayload>) => send<PlatformEvent>('patch', `/events/${id}`, payload),
  cancel: (id: number, reason?: string) => send<PlatformEvent>('post', `/events/${id}/cancel`, { reason: reason || undefined }),
  uploadCover: (id: number, file: File) => send<PlatformEvent>('post', `/events/${id}/image`, form({ image: file })),
  register: (id: number) => send<EventRegistration>('post', `/events/${id}/register`),
  unregister: (id: number) => send('delete', `/events/${id}/register`),
  mine: (query: { page: number, limit: number }) => get<Page<EventRegistration>>('/events/my', query),
  registrations: (query: { eventId?: number | null, page?: number, limit?: number }) => get<Page<EventRegistration>>('/events/registrations', query),
  setRegistrationStatus: (id: number, status: Exclude<RegistrationStatus, 'new'>) => send<EventRegistration>('patch', `/events/registrations/${id}`, { status })
}

export interface NewsPayload {
  title: string
  subtitle?: string | null
  excerpt?: string | null
  content: string
  isPublished?: boolean
}

export const newsApi = {
  list: (query: { page?: number, limit?: number, q?: string, published?: boolean | null }) => get<Page<NewsItem>>('/news', query),
  get: (id: number) => get<NewsItem>(`/news/${id}`),
  create: (payload: NewsPayload) => send<NewsItem>('post', '/news', payload),
  update: (id: number, payload: Partial<NewsPayload>) => send<NewsItem>('patch', `/news/${id}`, payload),
  addImages: (id: number, list: File[]) => send<NewsItem>('post', `/news/${id}/images`, files('images', list))
}

export const tariffsApi = {
  view: (category: TariffCategory) => get<TariffView>('/tariffs/view', { category }),
  adminView: (category: TariffCategory, includeInactive = true) => get<TariffView>('/tariffs/admin/view', { category, includeInactive }),
  putRate: (propertyId: number, category: TariffCategory, payload: { commissionFrom: number, commissionTo?: number | null, notes?: string | null, isActive?: boolean }) =>
    send<TariffRate>('put', `/tariffs/properties/${propertyId}/rates/${category}`, payload)
}

export const supportApi = {
  guestSession: (roomId?: string, guestToken?: string | null) =>
    (http.post<{ roomId: string, guestToken: string | null }>('/support/guest-session', { roomId }, {
      headers: guestToken ? { 'x-support-guest-token': guestToken } : {}
    })).then((response) => response.data),
  history: (roomId: string, guestToken?: string | null, query: { limit?: number, beforeId?: number } = {}) =>
    (http.get<SupportMessage[]>('/support/history', {
      params: clean({ roomId, ...query }),
      headers: guestToken ? { 'x-support-guest-token': guestToken } : {}
    })).then((response) => response.data),
  chats: (query: { page?: number, limit?: number } = {}) => get<SupportChatSummary[]>('/support/chats', query),
  markRead: (roomId: string) => send('post', '/support/read', { roomId }),
  resolve: (roomId: string, resolved: boolean) => send('post', '/support/chats/resolve', { roomId, resolved }),
  request: (payload: { message: string, name?: string, email?: string }) => send('post', '/support', payload)
}

export const addressApi = {
  suggest: (kind: 'region' | 'city' | 'street', q: string, context: { region?: string, city?: string } = {}) =>
    get<AddressSuggestion[]>('/address/suggest', { kind, q, ...context })
}

export const auditApi = {
  list: (query: { entityType?: AuditEntry['entityType'] | '', entityId?: number | null, page: number, limit: number }) =>
    get<Page<AuditEntry>>('/audit', query)
}
