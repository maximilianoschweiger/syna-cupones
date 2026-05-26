/**
 * AI Service — supports Google Gemini (default, free tier) and OpenAI as fallback.
 *
 * Provider selection:
 *   AI_PROVIDER=gemini  → uses GEMINI_API_KEY  (default, free up to 1500 req/day)
 *   AI_PROVIDER=openai  → uses OPENAI_API_KEY
 */
import { GoogleGenerativeAI } from '@google/generative-ai'
import OpenAI from 'openai'
import logger from '../utils/logger.js'

const ANALYSIS_PROMPT = `Eres un experto en análisis de cupones de tarjetas de crédito y débito argentinos.

Analiza esta imagen y extrae información de TODOS los documentos visibles (cupones y cierres de lote).

Devuelve EXACTAMENTE este JSON (sin markdown, sin texto extra):
{
  "documents": [
    {
      "isBatchClose": false,
      "batchNumber": null,
      "couponNumber": null,
      "amount": null,
      "installments": null,
      "cardType": null,
      "authCode": null,
      "merchant": null,
      "couponDate": null,
      "signatureStatus": "UNSIGNED",
      "hasDni": false,
      "hasAclaracion": false,
      "isPartialSignature": false,
      "hasManualWriting": false,
      "missingFields": [],
      "ocrText": "",
      "confidence": 0.5,
      "imageQualityScore": 0.5,
      "signatureNotes": ""
    }
  ],
  "totalDocuments": 1,
  "overallImageQuality": "GOOD"
}

DEFINICIONES:

isBatchClose: true si el documento es CIERRE DE LOTE / BATCH CLOSE / TOTALIZACIÓN, false si es cupón normal.
batchNumber: número de lote si isBatchClose=true, o null.
couponNumber: número de cupón impreso (6-12 dígitos), null si no se lee.
amount: monto decimal (ej: 1500.50), null si no se lee.
installments: número de cuotas entero, null si no aplica.
cardType: VISA / MASTERCARD / AMEX / NARANJA / CABAL / MAESTRO / otro / null.
authCode: código de autorización alfanumérico, null si no se lee.
merchant: nombre del comercio o sucursal, null si no se lee.
couponDate: fecha YYYY-MM-DD, null si no se lee.

signatureStatus:
  SIGNED    → firma claramente visible en espacio de firma
  UNSIGNED  → espacio de firma vacío o en blanco
  DUBIOUS   → firma dudosa / ilegible / imagen no permite determinarlo

hasDni: true si hay número de DNI del cliente escrito.
hasAclaracion: true si hay nombre/aclaración manuscrita bajo/junto a la firma.
isPartialSignature: true si hay algo en el área de firma pero es incompleto.
hasManualWriting: true si hay escritura manual visible (distinta a la firma).

missingFields: lista de campos ausentes. Posibles valores:
  "firma" si signatureStatus=UNSIGNED
  "dni" si hasDni=false
  "aclaracion" si hasAclaracion=false
  "monto" si amount=null e isBatchClose=false
  "fecha" si couponDate=null
  "cuotas" si installments=null y tarjeta de crédito (VISA/MC/AMEX/NARANJA/CABAL)
  "numero_cupon" si couponNumber=null

ocrText: TODO el texto legible extraído de la imagen.
confidence: 0.9-1.0 muy claro / 0.7-0.9 legible / 0.5-0.7 regular / 0.0-0.5 mala calidad.
imageQualityScore: 0.9-1.0 nítida / 0.7-0.9 aceptable / 0.5-0.7 borrosa/inclinada / 0.0-0.5 muy deficiente.
overallImageQuality: GOOD / BLURRY / ROTATED / PARTIAL / DARK / OVEREXPOSED`

// ─── Provider factory ────────────────────────────────────────────────────────

function getProvider() {
  const p = (process.env.AI_PROVIDER || 'gemini').toLowerCase()
  if (p === 'openai') return 'openai'
  return 'gemini'
}

// ─── Gemini implementation ───────────────────────────────────────────────────

async function analyzeWithGemini(imageUrl, model) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not set')

  const genai     = new GoogleGenerativeAI(apiKey)
  const gemModel  = genai.getGenerativeModel({
    model,
    generationConfig: {
      responseMimeType: 'application/json',
      maxOutputTokens: 3000,
    },
  })

  // Fetch image from Cloudinary URL and encode as base64
  const imgResponse = await fetch(imageUrl)
  if (!imgResponse.ok) throw new Error(`Failed to fetch image: ${imgResponse.status}`)
  const arrayBuffer = await imgResponse.arrayBuffer()
  const base64      = Buffer.from(arrayBuffer).toString('base64')
  const mimeType    = imgResponse.headers.get('content-type') || 'image/jpeg'

  const result = await gemModel.generateContent([
    { inlineData: { data: base64, mimeType } },
    ANALYSIS_PROMPT,
  ])

  const text = result.response.text()
  const parsed = JSON.parse(text)
  if (!Array.isArray(parsed.documents)) throw new Error('Invalid Gemini response: missing documents array')
  return parsed.documents.map(normalizeDocument)
}

// ─── OpenAI fallback implementation ─────────────────────────────────────────

async function analyzeWithOpenAI(imageUrl, model) {
  const openai = new OpenAI({
    apiKey:  process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_API_BASE_URL || undefined,
    defaultHeaders: process.env.OPENAI_API_BASE_URL
      ? { 'HTTP-Referer': 'https://syna-cupones.com', 'X-Title': 'Syna Cupones' }
      : undefined,
  })

  const response = await openai.chat.completions.create({
    model,
    max_tokens: 3000,
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } },
        { type: 'text', text: ANALYSIS_PROMPT },
      ],
    }],
    response_format: { type: 'json_object' },
  })

  const content = response.choices[0]?.message?.content
  if (!content) throw new Error('Empty OpenAI response')
  const parsed = JSON.parse(content)
  if (!Array.isArray(parsed.documents)) throw new Error('Invalid OpenAI response: missing documents array')
  return parsed.documents.map(normalizeDocument)
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Analyze a coupon image and return an array of detected documents.
 * Model defaults: gemini-1.5-flash (free) or gpt-4o depending on provider.
 */
async function analyzeCouponImage(imageUrl, model = null) {
  const provider     = getProvider()
  const defaultModel = provider === 'gemini' ? 'gemini-1.5-flash' : 'gpt-4o'
  const resolvedModel = model || process.env.AI_MODEL || defaultModel

  const MAX_RETRIES = 3

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      logger.info(`AI analysis [${provider}/${resolvedModel}] attempt ${attempt}/${MAX_RETRIES}`, {
        url: imageUrl.slice(0, 80),
      })

      const docs = provider === 'gemini'
        ? await analyzeWithGemini(imageUrl, resolvedModel)
        : await analyzeWithOpenAI(imageUrl, resolvedModel)

      logger.info('AI analysis complete', { provider, model: resolvedModel, docs: docs.length })
      return docs
    } catch (err) {
      logger.error(`AI attempt ${attempt} failed [${provider}]`, { error: err.message })
      if (attempt < MAX_RETRIES) await new Promise((r) => setTimeout(r, 1000 * attempt))
    }
  }

  logger.error('AI analysis failed after all retries, returning DUBIOUS placeholder')
  return [buildPlaceholder()]
}

/**
 * Analyze and return first document (used for single-coupon reanalysis).
 */
async function analyzeImage(imageUrl) {
  const results = await analyzeCouponImage(imageUrl)
  return results[0] || buildPlaceholder()
}

/**
 * Test AI provider connectivity.
 */
async function testOpenAI() {
  const provider = getProvider()
  if (provider === 'gemini') {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return false
    const genai = new GoogleGenerativeAI(apiKey)
    const model = genai.getGenerativeModel({ model: 'gemini-1.5-flash' })
    const result = await model.generateContent('ping')
    return !!result.response.text()
  } else {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const r = await openai.chat.completions.create({
      model: 'gpt-4o-mini', max_tokens: 5,
      messages: [{ role: 'user', content: 'ping' }],
    })
    return !!r.choices[0]?.message?.content
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeDocument(doc) {
  return {
    isBatchClose:       !!doc.isBatchClose,
    batchNumber:        doc.batchNumber   || null,
    couponNumber:       doc.couponNumber  || null,
    amount:             doc.amount        != null ? parseFloat(doc.amount)    : null,
    installments:       doc.installments  != null ? parseInt(doc.installments) : null,
    cardType:           doc.cardType      || null,
    authCode:           doc.authCode      || null,
    merchant:           doc.merchant      || null,
    couponDate:         doc.couponDate    ? new Date(doc.couponDate) : null,
    signatureStatus:    validateStatus(doc.signatureStatus),
    hasDni:             typeof doc.hasDni             === 'boolean' ? doc.hasDni             : null,
    hasAclaracion:      typeof doc.hasAclaracion      === 'boolean' ? doc.hasAclaracion      : null,
    isPartialSignature: typeof doc.isPartialSignature === 'boolean' ? doc.isPartialSignature : null,
    hasManualWriting:   typeof doc.hasManualWriting   === 'boolean' ? doc.hasManualWriting   : null,
    missingFields:      Array.isArray(doc.missingFields) ? doc.missingFields : [],
    ocrText:            doc.ocrText           || null,
    aiConfidence:       parseFloat(doc.confidence)       || 0.5,
    imageQualityScore:  parseFloat(doc.imageQualityScore) || null,
    aiRawResponse:      doc,
  }
}

function buildPlaceholder() {
  return {
    isBatchClose: false,
    signatureStatus: 'DUBIOUS',
    aiConfidence: 0,
    imageQualityScore: 0,
    missingFields: ['firma', 'monto', 'fecha'],
    aiRawResponse: { error: 'AI analysis failed after all retries' },
  }
}

function validateStatus(s) {
  return ['SIGNED', 'UNSIGNED', 'DUBIOUS', 'PENDING'].includes(s) ? s : 'DUBIOUS'
}

export { analyzeCouponImage, analyzeImage, testOpenAI }
