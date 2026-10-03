const proxyaddr = require('proxy-addr')
const { ipKeyGenerator } = require('express-rate-limit')
const { trustedProxies } = require('../config/environment')

function createClientIpResolver (env = process.env) {
  const trust = trustedProxies(env)
  return request => ipKeyGenerator(proxyaddr(request, trust).replace(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/, '$1'), 56)
}

module.exports = { createClientIpResolver }
