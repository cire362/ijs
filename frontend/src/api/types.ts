// Shapes of the backend JSON responses (Sequelize models serialized with camelCase keys).

export type Role = 'agent' | 'individual' | 'developer' | 'admin'
export type ISODate = string

export interface User {
  id: number
  firstName: string | null
  lastName: string | null
  middleName: string | null
  fullName: string
  email: string
  phone: string | null
  role: Role
  companyName: string | null
  developerApproved: boolean
  developerRejected?: boolean
  avatarUrl: string | null
  legalConsentAcceptedAt: ISODate | null
  legalConsentVersion: string | null
  marketingConsentGiven: boolean
  marketingConsentAcceptedAt: ISODate | null
  marketingConsentWithdrawnAt: ISODate | null
  marketingConsentVersion: string | null
  createdAt?: ISODate
  updatedAt?: ISODate
}

export interface PersonRef {
  id: number
  firstName: string | null
  lastName: string | null
  middleName: string | null
  email?: string
  phone?: string | null
  role?: Role
  companyName?: string | null
}

export type SaleStatus = 'available' | 'reserved' | 'sold'

export interface PropertyImage { id: number, url: string, caption: string | null }
export interface PropertyDocument { id: number, url: string, originalName: string | null, mimeType: string | null }

export type TariffCategory = 'apartments' | 'commercial' | 'parking' | 'storage'

export interface TariffRate {
  id: number
  propertyId?: number
  category: TariffCategory
  commissionFrom: string
  commissionTo: string | null
  notes: string | null
  isActive: boolean
}

export interface Property {
  id: number
  title: string
  developerId: number
  region: string
  city: string
  street: string | null
  plotNumber: string | null
  landArea: number | null
  houseArea: number | null
  floors: number | null
  rooms: number | null
  finishingType: string | null
  contractType: string | null
  constructionType: string | null
  readinessType: string | null
  registration: string | null
  saleStatus: SaleStatus
  buildStage: string | null
  price: string | null
  description: string | null
  latitude: number | null
  longitude: number | null
  /** 0 exact house or manual pin, 1 nearest house, 2 street, 3 settlement. */
  geoPrecision: number | null
  createdAt: ISODate
  updatedAt: ISODate
  developer?: PersonRef
  images?: PropertyImage[]
  documents?: PropertyDocument[]
  tariffRates?: TariffRate[]
}

export type ApplicationStatus =
  | 'sent' | 'confirmed' | 'contract_signed' | 'awaiting_payment' | 'commission_available'
  | 'done' | 'rejected' | 'expired' | 'cancelled'

export interface StatusHistoryEntry {
  id: number
  applicationId: number
  status: ApplicationStatus
  changedBy: number | null
  comment: string | null
  createdAt: ISODate
  actor?: PersonRef | null
}

export interface Application {
  id: number
  propertyId: number
  agentId: number
  status: ApplicationStatus
  expiresAt: ISODate | null
  commissionAmount: string | null
  commissionRateId: number | null
  commissionRatePercent: string | null
  commissionBasePrice: string | null
  comment: string | null
  clientFullName: string | null
  clientPhone: string | null
  createdAt: ISODate
  updatedAt: ISODate
  property?: Property
  agent?: PersonRef
  history?: StatusHistoryEntry[]
}

export interface ApplicationChatSummary {
  applicationId: number
  title: string
  lastMessage: string
  lastTime: ISODate
  agent?: PersonRef
}

export interface ApplicationChatMessage {
  id: number
  applicationId: number
  senderId: number
  senderRole: Role
  text: string | null
  attachmentUrl: string | null
  attachmentOriginalName: string | null
  attachmentMimeType: string | null
  attachmentSize: number | null
  createdAt: ISODate
  sender?: PersonRef
}

export interface SupportChatSummary {
  roomId: string
  senderName: string
  senderEmail: string | null
  lastMessage: string
  lastTime: ISODate
  unreadCount: number
  isResolved: boolean
  resolvedAt: ISODate | null
  resolvedBy: number | null
}

export interface SupportMessage {
  id?: number
  roomId: string
  text: string
  isAdmin?: boolean
  senderName?: string | null
  senderEmail?: string | null
  createdAt?: ISODate
  timestamp?: ISODate
  sender?: 'support'
}

export interface AppNotification {
  id: number
  userId: number
  type: string
  key: string | null
  text: string
  isRead: boolean
  meta: Record<string, unknown> | null
  createdAt: ISODate
}

export type EventFormat = 'offline' | 'online' | 'hybrid'
export type RegistrationStatus = 'new' | 'approved' | 'rejected'

export interface PlatformEvent {
  id: number
  title: string
  description: string | null
  location: string | null
  format: EventFormat | null
  coverImageUrl: string | null
  startAt: ISODate
  endAt: ISODate | null
  isTraining: boolean
  capacity: number | null
  cancelledAt: ISODate | null
  cancelReason: string | null
  createdBy: number
  createdAt: ISODate
}

export interface EventRegistration {
  id: number
  eventId: number
  agentId: number
  status: RegistrationStatus
  comment: string | null
  createdAt: ISODate
  event?: PlatformEvent
  agent?: PersonRef
}

export interface NewsImage { id: number, url: string, caption: string | null }

export interface NewsItem {
  id: number
  title: string
  subtitle: string | null
  excerpt: string | null
  content: string
  isPublished: boolean
  publishedAt: ISODate | null
  authorId: number
  createdAt: ISODate
  author?: PersonRef
  images?: NewsImage[]
}

export interface TariffComplex {
  id: number
  name: string
  isActive: boolean
  rate: TariffRate | null
}

export interface TariffCounterparty {
  id: number
  type: 'developer'
  name: string
  isActive: boolean
  complexes: TariffComplex[]
}

export interface TariffView {
  type: 'developer'
  category: TariffCategory
  counterparties: TariffCounterparty[]
}

export interface AuditEntry {
  id: number
  entityType: 'property' | 'tariff_rate' | 'application' | 'user'
  entityId: number
  actorId: number | null
  action: string
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  createdAt: ISODate
}

export interface Page<T> {
  items: T[]
  total: number
  page: number
  limit: number
}

export interface AddressSuggestion {
  label: string
  value: string
  region: string | null
  city: string | null
  street: string | null
  house: string | null
  lat: number | null
  lng: number | null
  precision: number | null
}

export interface CatalogFacets {
  regions: { value: string, count: number }[]
  cities: { value: string, region: string, count: number }[]
  developers: { id: number, name: string, count: number }[]
}
