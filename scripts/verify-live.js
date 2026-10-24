require('dotenv').config({ quiet: true })
const assert = require('node:assert/strict')
const fs = require('node:fs')
const jwt = require('jsonwebtoken')

async function main() {
  const cases = [
    [{ username: 'Bret' }, 200],
    [{ username: 'unknown' }, 404],
    [{ username: 'bret' }, 404],
    [{}, 400],
    [{ username: 123 }, 400],
  ]
  const results = []
  for (const [body, expected] of cases) {
    const response = await fetch('http://127.0.0.1:3000/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const data = await response.json()
    assert.equal(response.status, expected)
    if (data.token) {
      const payload = jwt.verify(data.token, process.env.JWT_SECRET, { algorithms: ['HS256'] })
      assert.equal(payload.exp - payload.iat, 600)
      results.push({ request: body, status: response.status, signatureVerified: true, payload })
    } else results.push({ request: body, status: response.status, response: data })
  }
  if (process.argv[2]) {
    const token = fs.readFileSync(process.argv[2], 'utf8').trim()
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] })
    assert.equal(payload.exp - payload.iat, 600)
    results.push({ source: 'browser screenshot token', signatureVerified: true, lifetimeSeconds: 600, payload })
  }
  console.log(JSON.stringify({ verifiedAt: new Date().toISOString(), results }, null, 2))
}
main().catch(error => { console.error(error); process.exitCode = 1 })
