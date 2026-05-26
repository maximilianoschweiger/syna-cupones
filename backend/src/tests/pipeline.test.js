/**
 * Pipeline unit + integration tests.
 * Run with: node --experimental-vm-modules src/tests/pipeline.test.js
 * (No test runner dependency needed — uses Node's built-in assert)
 */
import assert from 'node:assert/strict'
import { detectBranch, detectShift } from '../services/imapService.js'
import { getPdfPageUrl } from '../services/cloudinaryService.js'

let passed = 0
let failed = 0

function test(name, fn) {
  try {
    fn()
    console.log(`  ✅ ${name}`)
    passed++
  } catch (err) {
    console.error(`  ❌ ${name}`)
    console.error(`     ${err.message}`)
    failed++
  }
}

// ─── detectBranch ────────────────────────────────────────────────────────────
console.log('\n📧 detectBranch()')

test('detects SUC110 pattern', () => {
  assert.equal(detectBranch('Cierre SUC110 TM', ''), '110')
})
test('detects SUCURSAL 215 pattern', () => {
  assert.equal(detectBranch('SUCURSAL 215 turno tarde', ''), '215')
})
test('detects Suc.310 pattern', () => {
  assert.equal(detectBranch('Suc.310 cierre', ''), '310')
})
test('detects branch from sender email address', () => {
  // suc410@syna.com.ar → pattern SUC[.\s#-]?(\d{2,4}) matches → '410'
  assert.equal(detectBranch('cupones', 'suc410@syna.com.ar'), '410')
})
test('returns null for no match', () => {
  assert.equal(detectBranch('Hola mundo', 'unknown@gmail.com'), null)
})
test('detects N° 524', () => {
  assert.equal(detectBranch('N° 524 cierre de caja', ''), '524')
})

// ─── detectShift ─────────────────────────────────────────────────────────────
console.log('\n🕐 detectShift()')

test('detects MORNING from "TURNO MAÑANA"', () => {
  assert.equal(detectShift('TURNO MAÑANA SUC110'), 'MORNING')
})
test('detects MORNING from "TM"', () => {
  assert.equal(detectShift('Suc 110 TM cierre'), 'MORNING')
})
test('detects AFTERNOON from "TURNO TARDE"', () => {
  assert.equal(detectShift('TURNO TARDE - Suc 215'), 'AFTERNOON')
})
test('detects NIGHT from "NOCHE"', () => {
  assert.equal(detectShift('NOCHE cupones'), 'NIGHT')
})
test('detects CLOSING from "CIERRE DE CAJA"', () => {
  assert.equal(detectShift('CIERRE DE CAJA SUC 110'), 'CLOSING')
})
test('detects CLOSING from "CIERRE"', () => {
  assert.equal(detectShift('SUC110 CIERRE'), 'CLOSING')
})
test('returns UNKNOWN for unrecognized subject', () => {
  assert.equal(detectShift('Adjuntos del día'), 'UNKNOWN')
})

// ─── getPdfPageUrl ────────────────────────────────────────────────────────────
console.log('\n📄 getPdfPageUrl()')

process.env.CLOUDINARY_CLOUD_NAME = 'testcloud'

test('generates page 1 URL correctly', () => {
  const url = getPdfPageUrl('syna-cupones/pdfs/abc123', 1)
  assert.equal(url, 'https://res.cloudinary.com/testcloud/image/upload/pg_1/syna-cupones/pdfs/abc123.jpg')
})
test('generates page 3 URL correctly', () => {
  const url = getPdfPageUrl('syna-cupones/pdfs/xyz456', 3)
  assert.equal(url, 'https://res.cloudinary.com/testcloud/image/upload/pg_3/syna-cupones/pdfs/xyz456.jpg')
})
test('strips .jpg from publicId to avoid double extension', () => {
  const url = getPdfPageUrl('folder/file.jpg', 2)
  assert.ok(!url.includes('file.jpg.jpg'), 'double extension found')
})

// ─── OpenAI response normalizer ────────────────────────────────────────────────
console.log('\n🤖 normalizeDocument (openaiService)')

// Inline the normalizer for isolated testing
function validateStatus(s) {
  return ['SIGNED', 'UNSIGNED', 'DUBIOUS', 'PENDING'].includes(s) ? s : 'DUBIOUS'
}
function normalizeDocument(doc) {
  return {
    isBatchClose:       !!doc.isBatchClose,
    batchNumber:        doc.batchNumber || null,
    couponNumber:       doc.couponNumber || null,
    amount:             doc.amount != null ? parseFloat(doc.amount) : null,
    installments:       doc.installments != null ? parseInt(doc.installments) : null,
    cardType:           doc.cardType || null,
    authCode:           doc.authCode || null,
    merchant:           doc.merchant || null,
    couponDate:         doc.couponDate ? new Date(doc.couponDate) : null,
    signatureStatus:    validateStatus(doc.signatureStatus),
    hasDni:             typeof doc.hasDni === 'boolean' ? doc.hasDni : null,
    hasAclaracion:      typeof doc.hasAclaracion === 'boolean' ? doc.hasAclaracion : null,
    isPartialSignature: typeof doc.isPartialSignature === 'boolean' ? doc.isPartialSignature : null,
    hasManualWriting:   typeof doc.hasManualWriting === 'boolean' ? doc.hasManualWriting : null,
    missingFields:      Array.isArray(doc.missingFields) ? doc.missingFields : [],
    ocrText:            doc.ocrText || null,
    aiConfidence:       parseFloat(doc.confidence) || 0.5,
    imageQualityScore:  parseFloat(doc.imageQualityScore) || null,
    aiRawResponse:      doc,
  }
}

test('normalizes a full AI response correctly', () => {
  const raw = {
    isBatchClose: false, couponNumber: '123456', amount: '1500.50',
    installments: '3', cardType: 'VISA', authCode: 'AB1234',
    merchant: 'Suc. Centro', couponDate: '2026-05-15',
    signatureStatus: 'SIGNED', hasDni: true, hasAclaracion: false,
    isPartialSignature: false, hasManualWriting: true,
    missingFields: ['aclaracion'], ocrText: 'VISA 1500.50',
    confidence: 0.92, imageQualityScore: 0.88,
  }
  const n = normalizeDocument(raw)
  assert.equal(n.amount, 1500.5)
  assert.equal(n.installments, 3)
  assert.equal(n.signatureStatus, 'SIGNED')
  assert.equal(n.hasDni, true)
  assert.equal(n.hasAclaracion, false)
  assert.equal(n.aiConfidence, 0.92)
  assert.deepEqual(n.missingFields, ['aclaracion'])
})

test('defaults unknown signatureStatus to DUBIOUS', () => {
  const n = normalizeDocument({ signatureStatus: 'GARBAGE', confidence: 0.5, missingFields: [] })
  assert.equal(n.signatureStatus, 'DUBIOUS')
})

test('handles missing amount gracefully', () => {
  const n = normalizeDocument({ signatureStatus: 'UNSIGNED', confidence: 0.3, missingFields: [] })
  assert.equal(n.amount, null)
})

test('isBatchClose coerced to boolean', () => {
  assert.equal(normalizeDocument({ isBatchClose: 1, confidence: 0.5, missingFields: [] }).isBatchClose, true)
  assert.equal(normalizeDocument({ isBatchClose: 0, confidence: 0.5, missingFields: [] }).isBatchClose, false)
  assert.equal(normalizeDocument({ isBatchClose: undefined, confidence: 0.5, missingFields: [] }).isBatchClose, false)
})

test('missingFields defaults to [] if not array', () => {
  const n = normalizeDocument({ signatureStatus: 'SIGNED', confidence: 0.7, missingFields: null })
  assert.deepEqual(n.missingFields, [])
})

test('couponDate parsed as Date object', () => {
  const n = normalizeDocument({ couponDate: '2026-01-15', confidence: 0.8, missingFields: [] })
  assert.ok(n.couponDate instanceof Date)
  assert.equal(n.couponDate.getFullYear(), 2026)
})

// ─── Summary ────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`)
console.log(`Results: ${passed} passed, ${failed} failed`)
if (failed > 0) {
  console.error('⚠️  Some tests failed — review errors above.')
  process.exit(1)
} else {
  console.log('✅ All tests passed.')
}
