const http = require('http')
const request = require('supertest')
const jwt = require('jsonwebtoken')
const { io: connectClient } = require('socket.io-client')
const app = require('../src/app')
const { sequelize } = require('../src/db')
const { User, AuthSession, Property, Application, ChatMessage } = require('../src/models')
const { createRealtimeServer } = require('../src/realtime')
const { setIO } = require('../src/socket')
const { hashToken } = require('../src/utils/authTokens')
const { issueGuestSupportSession } = require('../src/utils/guestSupportSession')
const { syncAndTruncateExcept } = require('./testDb')
let io, server, url, admin, agent, other, application
const clients = []
const sessions = new Map()
const tokens = new Map()

function event (socket, name, timeout = 4000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.off(name, receive); reject(new Error(`Timed out waiting for ${name}`)) }, timeout)
    function receive (...args) { clearTimeout(timer); resolve(args[0]) }
    socket.once(name, receive)
  })
}
async function client () {
  const socket = connectClient(url, { transports: ['websocket'], forceNew: true, reconnection: false })
  clients.push(socket)
  await event(socket, 'connect')
  return socket
}
function emit (socket, name, payload) {
  return new Promise((resolve, reject) => socket.timeout(4000).emit(name, payload, (error, result) => error ? reject(error) : resolve(result)))
}
function rooms (client) { return io.sockets.sockets.get(client.id).rooms }

beforeAll(async () => {
  await syncAndTruncateExcept(sequelize)
  const users = await User.bulkCreate(['admin', 'agent', 'agent', 'developer'].map((role, i) => ({ role, email: `socket-${i}@test.com`, passwordHash: 'fixture', developerApproved: true })))
  ;[admin, agent, other] = users
  for (const user of users) {
    const session = await AuthSession.create({ userId: user.id, refreshTokenHash: hashToken(`socket-${user.id}`), expiresAt: new Date(Date.now() + 3600000) })
    sessions.set(user.id, session)
    tokens.set(user.id, jwt.sign({ sub: user.id, sid: session.id }, process.env.JWT_SECRET, { expiresIn: '1h' }))
  }
  const property = await Property.create({ title: 'Дом', region: 'Р', city: 'Г', developerId: users[3].id })
  application = await Application.create({ propertyId: property.id, agentId: agent.id })
  server = http.createServer(app)
  io = createRealtimeServer(server, { maxEvents: 6, sessionCheckMs: 1000 })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  url = `http://127.0.0.1:${server.address().port}`
})
afterEach(() => { for (const socket of clients.splice(0)) socket.disconnect() })
afterAll(async () => {
  if (io) await new Promise((resolve) => io.close(resolve))
  setIO(null)
  await sequelize.close()
})

test('notification subscriptions and application rooms require ownership', async () => {
  const own = await client()
  await emit(own, 'subscribe', { userId: agent.id, token: tokens.get(agent.id) })
  expect(rooms(own).has(`user:${agent.id}`)).toBe(true)
  await emit(own, 'subscribe', { userId: other.id, token: tokens.get(agent.id) })
  expect(rooms(own).has(`user:${other.id}`)).toBe(false)
  await emit(own, 'application_chat_join', { applicationId: application.id, token: tokens.get(agent.id) })
  expect(rooms(own).has(`application:${application.id}`)).toBe(true)
  const stranger = await client()
  await emit(stranger, 'application_chat_join', { applicationId: application.id, token: tokens.get(other.id) })
  expect(rooms(stranger).has(`application:${application.id}`)).toBe(false)
  await emit(stranger, 'application_chat_join', { applicationId: `${application.id}garbage`, token: tokens.get(other.id) })
  expect(rooms(stranger).has(`application:${application.id}`)).toBe(false)
  await emit(stranger, 'admin_subscribe', { token: tokens.get(other.id) })
  expect(rooms(stranger).has('admins')).toBe(false)
})
test('changing identity removes previously authorized rooms', async () => {
  const socket = await client()
  await emit(socket, 'admin_subscribe', { token: tokens.get(admin.id) })
  await emit(socket, 'application_admin_subscribe', { token: tokens.get(admin.id) })
  expect(rooms(socket).has('admins')).toBe(true)
  await emit(socket, 'subscribe', { userId: agent.id, token: tokens.get(agent.id) })
  expect(rooms(socket).has('admins')).toBe(false)
  expect(rooms(socket).has('application_admins')).toBe(false)
  expect(rooms(socket).has(`session:${sessions.get(admin.id).id}`)).toBe(false)
  expect(rooms(socket).has(`user:${agent.id}`)).toBe(true)
})
test('guest rooms are isolated and tokens never appear in admin notifications', async () => {
  const adminSocket = await client()
  await emit(adminSocket, 'admin_subscribe', { token: tokens.get(admin.id) })
  const guest = issueGuestSupportSession()
  const differentGuest = issueGuestSupportSession()
  const socket = await client()
  await emit(socket, 'join_room', { roomId: guest.roomId, guestToken: differentGuest.guestToken })
  expect(rooms(socket).has(guest.roomId)).toBe(false)
  await emit(socket, 'join_room', guest)
  expect(rooms(socket).has(guest.roomId)).toBe(true)
  const incoming = event(adminSocket, 'new_support_message')
  await emit(socket, 'chat_message', { ...guest, text: 'Помогите', senderName: 'Клиент', senderEmail: 'guest@test.com' })
  const message = await incoming
  expect(message.roomId).toBe(guest.roomId)
  expect(JSON.stringify(message)).not.toContain(guest.guestToken)
  expect(message).not.toHaveProperty('token')
  const reply = event(socket, 'chat_message')
  await emit(adminSocket, 'admin_reply', { roomId: guest.roomId, text: 'Ответ', token: tokens.get(admin.id) })
  expect((await reply).text).toBe('Ответ')
})
test('an invalid token grants no rooms and does not drop the active session subscriptions', async () => {
  const socket = await client()
  await emit(socket, 'subscribe', { userId: agent.id, token: tokens.get(agent.id) })
  await emit(socket, 'subscribe', { userId: other.id, token: 'invalid' })
  expect(rooms(socket).has(`user:${other.id}`)).toBe(false)
  expect(rooms(socket).has(`user:${agent.id}`)).toBe(true)
  const forged = jwt.sign({ sub: other.id, sid: sessions.get(other.id).id }, 'wrong-secret', { expiresIn: 60 })
  await emit(socket, 'subscribe', { userId: other.id, token: forged })
  expect(rooms(socket).has(`user:${other.id}`)).toBe(false)
})
test('socket rate limits stop additional message writes', async () => {
  const socket = await client()
  const guest = issueGuestSupportSession()
  for (let i = 0; i < 6; i++) expect((await emit(socket, 'chat_message', { ...guest, text: `Message ${i}` })).processed).toBe(true)
  expect((await emit(socket, 'chat_message', { ...guest, text: 'Rejected message' })).code).toBe('rate_limit')
  expect(await ChatMessage.count({ where: { roomId: guest.roomId } })).toBe(6)
})
test('access token expiry keeps the socket of an active session; session expiry closes it', async () => {
  const user = await User.create({ role: 'agent', email: 'expiring-socket@test.com', passwordHash: 'fixture' })
  const session = await AuthSession.create({ userId: user.id, refreshTokenHash: hashToken('expiring-socket'), expiresAt: new Date(Date.now() + 3500) })
  const own = await Application.create({ propertyId: application.propertyId, agentId: user.id })
  const socket = await client()
  const token = jwt.sign({ sub: user.id, sid: session.id }, process.env.JWT_SECRET, { expiresIn: 1 })
  await emit(socket, 'subscribe', { userId: user.id, token })
  const disconnected = event(socket, 'disconnect', 6000)
  await new Promise((resolve) => setTimeout(resolve, 1500))
  expect(socket.connected).toBe(true)
  expect(rooms(socket).has(`user:${user.id}`)).toBe(true)
  // The frontend may still hold the expired token of this session.
  await emit(socket, 'application_chat_join', { applicationId: own.id, token })
  expect(rooms(socket).has(`application:${own.id}`)).toBe(true)
  // An expired token cannot open a socket that was not bound to that session.
  const stranger = await client()
  await emit(stranger, 'subscribe', { userId: user.id, token })
  expect(rooms(stranger).has(`user:${user.id}`)).toBe(false)
  expect(await disconnected).toBe('io server disconnect')
})
test('a session extended by refresh keeps its socket past the original expiry', async () => {
  const user = await User.create({ role: 'agent', email: 'extended-socket@test.com', passwordHash: 'fixture' })
  const session = await AuthSession.create({ userId: user.id, refreshTokenHash: hashToken('extended-socket'), expiresAt: new Date(Date.now() + 2000) })
  const socket = await client()
  await emit(socket, 'subscribe', { userId: user.id, token: jwt.sign({ sub: user.id, sid: session.id }, process.env.JWT_SECRET, { expiresIn: 60 }) })
  await session.update({ expiresAt: new Date(Date.now() + 60000) })
  await new Promise((resolve) => setTimeout(resolve, 3000))
  expect(socket.connected).toBe(true)
  expect(rooms(socket).has(`user:${user.id}`)).toBe(true)
})
test('revoking a session outside this process closes an idle connection', async () => {
  const user = await User.create({ role: 'agent', email: 'revoked-socket@test.com', passwordHash: 'fixture' })
  const session = await AuthSession.create({ userId: user.id, refreshTokenHash: hashToken('revoked-socket'), expiresAt: new Date(Date.now() + 60000) })
  const socket = await client()
  await emit(socket, 'subscribe', { userId: user.id, token: jwt.sign({ sub: user.id, sid: session.id }, process.env.JWT_SECRET, { expiresIn: 60 }) })
  const disconnected = event(socket, 'disconnect')
  await session.destroy()
  expect(await disconnected).toBe('io server disconnect')
})
test('HTTP logout closes sockets belonging to that session', async () => {
  const user = await User.create({ role: 'agent', email: 'logout-socket@test.com', passwordHash: 'fixture' })
  const refresh = 'logout-refresh'
  const session = await AuthSession.create({ userId: user.id, refreshTokenHash: hashToken(refresh), expiresAt: new Date(Date.now() + 60000) })
  const socket = await client()
  await emit(socket, 'subscribe', { userId: user.id, token: jwt.sign({ sub: user.id, sid: session.id }, process.env.JWT_SECRET, { expiresIn: 60 }) })
  const disconnected = event(socket, 'disconnect')
  const response = await request(app).post('/auth/logout').set('Cookie', [`refresh_token=${refresh}`, 'csrf_token=fixture']).set('x-csrf-token', 'fixture')
  expect(response.status).toBe(200)
  expect(await disconnected).toBe('io server disconnect')
})
test('a disallowed browser origin cannot open a WebSocket connection', async () => {
  const socket = connectClient(url, { transports: ['websocket'], forceNew: true, reconnection: false, extraHeaders: { Origin: 'https://untrusted.example.com' } })
  clients.push(socket)
  expect(await event(socket, 'connect_error')).toBeInstanceOf(Error)
  expect(socket.connected).toBe(false)
})
