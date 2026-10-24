require('dotenv').config()

const express = require('express')
const path = require('node:path')
const { issueToken } = require('./auth')

const app = express()
const port = Number(process.env.PORT) || 3000

app.use(express.json())
app.use('/demo', express.static(path.join(__dirname, '../public')))

app.get('/', (req, res) => {
  res.json({ message: '멋쟁이사자처럼 14기 JWT 발급 실습' })
})

app.post('/login', async (req, res) => {
  try {
    const result = await issueToken(req.body?.username)
    res.json(result)
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message })
  }
})

app.use((error, req, res, next) => {
  const status = error.status || 500
  res.status(status).json({ message: status === 400 ? '올바른 JSON 본문 필요' : '요청 처리 실패' })
})

if (require.main === module) {
  app.listen(port, '127.0.0.1', () => {
    console.log(`JWT 실습 서버 실행: http://localhost:${port}`)
  })
}

module.exports = app
