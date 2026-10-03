const http = require('http')
const { io: connectClient } = require('socket.io-client')
const { createRealtimeServer } = require('../src/realtime')
const { sequelize } = require('../src/db')
const { setIO } = require('../src/socket')

afterAll(async () => { setIO(null); await sequelize.close() })
test.each([['loopback', false], ['', true]])('socket IP quotas use TRUST_PROXY=%s and reject forged prefixes', async (trusted, secondLimited) => {
  const original = process.env.TRUST_PROXY
  process.env.TRUST_PROXY = trusted
  const server = http.createServer()
  const io = createRealtimeServer(server, { maxIpEvents: 1, maxEvents: 10 })
  const clients = []
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    const url = `http://127.0.0.1:${server.address().port}`
    const client = async forwarded => {
      const socket = connectClient(url, { transports: ['websocket'], reconnection: false, forceNew: true, extraHeaders: { 'X-Forwarded-For': forwarded } })
      clients.push(socket)
      await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject) })
      return socket
    }
    const emit = socket => new Promise((resolve, reject) => socket.timeout(2000).emit('application_chat_leave', { applicationId: 1 }, (error, value) => error ? reject(error) : resolve(value)))
    const first = await client('203.0.113.10')
    const second = await client('192.0.2.99, 203.0.113.20')
    expect((await emit(first)).processed).toBe(true)
    const result = await emit(second)
    expect(result.code === 'rate_limit').toBe(secondLimited)
    if (!secondLimited) {
      const forged = await client('192.0.2.100, 203.0.113.20')
      expect((await emit(forged)).code).toBe('rate_limit')
    }
  } finally {
    clients.forEach(socket => socket.disconnect())
    await new Promise(resolve => io.close(resolve))
    if (original == null) delete process.env.TRUST_PROXY; else process.env.TRUST_PROXY = original
  }
})
