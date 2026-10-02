let io = null

function setIO (instance) {
  io = instance
}

function getIO () {
  return io
}

function disconnectSessions (ids) {
  if (!io) return
  for (const id of ids) io.in(`session:${id}`).disconnectSockets(true)
}

module.exports = { setIO, getIO, disconnectSessions }
