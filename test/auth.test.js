const { test } = require('node:test')
const assert = require('node:assert/strict')
const jwt = require('jsonwebtoken')
const { issueToken, fetchUsers } = require('../src/auth')
const secret = 'test-only-secret-not-used-by-the-running-server'
const user = { id: 1, username: 'Bret', name: 'Leanne Graham', email: 'Sincere@april.biz', phone: 'excluded', address: {} }
const fetcher = async () => ({ ok: true, json: async () => [user] })

test('HS256 signature, four user claims, exact 600-second lifetime and excluded fields', async () => {
  const { token } = await issueToken('Bret', secret, fetcher)
  const decoded = jwt.verify(token, secret, { algorithms: ['HS256'], complete: true })
  assert.equal(decoded.header.alg, 'HS256')
  assert.deepEqual(Object.keys(decoded.payload).sort(), ['sub', 'username', 'name', 'email', 'iat', 'exp'].sort())
  assert.equal(decoded.payload.sub, '1')
  for (const key of ['username', 'name', 'email']) assert.equal(decoded.payload[key], user[key])
  assert.equal(decoded.payload.exp - decoded.payload.iat, 600)
  assert.doesNotThrow(() => jwt.verify(token, secret, { clockTimestamp: decoded.payload.exp - 1 }))
  assert.throws(() => jwt.verify(token, secret, { clockTimestamp: decoded.payload.exp }), { name: 'TokenExpiredError' })
  assert.throws(() => jwt.verify(token, 'wrong-key'), { name: 'JsonWebTokenError' })
  const parts = token.split('.')
  parts[1] = Buffer.from(JSON.stringify({ ...decoded.payload, sub: '999' })).toString('base64url')
  assert.throws(() => jwt.verify(parts.join('.'), secret), /invalid signature/)
})

test('unknown username and case mismatch return 404', async () => {
  for (const name of ['unknown', 'bret']) await assert.rejects(issueToken(name, secret, fetcher), { status: 404, message: '사용자 없음' })
})
test('missing, blank and non-string username return 400', async () => {
  for (const name of [undefined, null, '', '  ', 123, {}, []]) await assert.rejects(issueToken(name, secret, fetcher), { status: 400 })
})
test('missing signing secret returns 500', async () => {
  await assert.rejects(issueToken('Bret', '', fetcher), { status: 500 })
})
test('upstream HTTP failure returns 502', async () => {
  await assert.rejects(fetchUsers(async () => ({ ok: false })), { status: 502 })
})
test('network failure returns 502', async () => {
  await assert.rejects(fetchUsers(async () => { throw new Error('network unavailable') }), { status: 502 })
})
test('invalid upstream JSON or non-array response returns 502', async () => {
  await assert.rejects(fetchUsers(async () => ({ ok: true, json: async () => ({}) })), { status: 502 })
  await assert.rejects(fetchUsers(async () => ({ ok: true, json: async () => { throw new SyntaxError() } })), { status: 502 })
})

test('HTTP route validates missing bodies and malformed JSON', async () => {
  const app = require('../src/server')
  const server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  const url = `http://127.0.0.1:${server.address().port}/login`
  try {
    for (const options of [{}, { headers: { 'Content-Type': 'application/json' }, body: '{}' }, { headers: { 'Content-Type': 'application/json' }, body: '{broken' }]) {
      const response = await fetch(url, { method: 'POST', ...options })
      assert.equal(response.status, 400)
      assert.equal(typeof (await response.json()).message, 'string')
    }
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
})
