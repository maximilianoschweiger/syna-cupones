import OpenAI from 'openai'
import logger from '../utils/logger.js'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

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

isBatchClose: true si el documento es un CIERRE DE LOTE / BATCH CLOSE / TOTALIZACIÓN DE LOTE, false si es un cupón normal.

batchNumber: número de lote si isBatchClose=true, o null.

couponNumber: número de cupón impreso (generalmente 6-12 dígitos), null si no se lee.

amount: monto decimal (ej: 1500.50), null si no se lee.

installments: número de cuotas entero, null si no aplica o no se lee.

cardType: VISA / MASTERCARD / AMEX / NARANJA / CABAL / MAESTRO / TARJETA_X / otro string / null.

authCode: código de autorización alfanumérico, null si no se lee.

merchant: nombre del comercio o sucursal, null si no se lee.

couponDate: fecha en formato YYYY-MM-DD, null si no se lee.

signatureStatus:
  SIGNED    → hay firma claramente visible en el espacio de firma
  UNSIGNED  → espacio de firma vacío o en blanco
  DUBIOUS   → firma dudosa / ilegible / muy débil / imagen no permite determinarlo

hasDni: true si hay un número de DNI del cliente escrito en algún campo del cupón.

hasAclaracion: true si hay nombre o texto aclaratorio manuscrito debajo o junto a la firma.

isPartialSignature: true si hay algo escrito en el área de firma pero es incompleto o poco claro.

hasManualWriting: true si hay escritura manual visible en cualquier parte del cupón (distinta a la firma).

missingFields: lista de campos ausentes/incompletos. Valores posibles: "firma", "dni", "aclaracion", "monto", "fecha", "cuotas", "numero_cupon", "codigo_auth", "comercio".
  Reglas:
  - Incluir "firma" si signatureStatus=UNSIGNED
  - Incluir "dni" si hasDni=false
  - Incluir "aclaracion" si hasAclaracion=false
  - Incluir "monto" si amount=null y isBatchClose=false
  - Incluir "fecha" si couponDate=null
  - Incluir "cuotas" si installments=null y cardType es de tipo crédito (VISA/MASTERCARD/AMEX/NARANJA/CABAL)
  - Incluir "numero_cupon" si couponNumber=null

ocrText: TODO el texto legible extraído de la imagen, concatenado. No omitir nada.

confidence:
  0.9-1.0 → datos muy claros y legibles
  0.7-0.9 → mayormente legibles con alguna duda menor
  0.5-0.7 → imagen regular, varios campos dudosos
  0.0-0.5 → imagen de mala calidad, muchos campos inciertos

imageQualityScore:
  0.9-1.0 → imagen nítida, bien iluminada, recta
  0.7-0.9 → imagen aceptable con defectos menores
  0.5-0.7 → imagen borrosa, inclinada o con mala iluminación
  0.0-0.5 → imagen muy deficiente (muy borrosa, muy oscura, muy inclinada, parcial)

overallImageQuality: GOOD / BLURRY / ROTATED / PARTIAL / DARK / OVEREXPOSED`

/**
 * Analyze a single image (URL) with OpenAI Vision.
 * Returns an array of analyzed documents (coupons + batch closes).
 */
async function analyzeCouponImage(imageUrl, model = 'gpt-4o') {
  const MAX_RETRIES = 3

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      logger.info(`AI analysis attempt ${attempt}/${MAX_RETRIES}`, { url: imageUrl.slice(0, 80) })

      const response = await openai.chat.completions.create({
        model,
        max_tokens: 3000,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } },
              { type: 'text', text: ANALYSIS_PROMPT },
            ],
          },
        ],
        response_format: { type: 'json_object' },
      })

      const content = response.choices[0]?.message?.content
      if (!content) throw new Error('Empty response from OpenAI')

      const parsed = JSON.parse(content)
      if (!Array.isArray(parsed.documents)) throw new Error('Invalid AI response: missing documents array')

      logger.info('AI analysis complete', {
        total: parsed.totalDocuments,
        quality: parsed.overallImageQuality,
      })

      return parsed.documents.map(normalizeDocument)
    } catch (err) {
      logger.error(`AI analysis attempt ${attempt} failed`, { error: err.message })
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 1000 * attempt))
      }
    }
  }

  logger.error('AI analysis failed after all retries, returning DUBIOUS placeholder')
  return [buildPlaceholder()]
}

/**
 * Analyze a single image and return the first document (used for reanalysis).
 */
async function analyzeImage(imageUrl, model = 'gpt-4o') {
  const results = await analyzeCouponImage(imageUrl, model)
  return results[0] || buildPlaceholder()
}

/**
 * Test OpenAI connectivity with minimal cost.
 */
async function testOpenAI() {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 5,
    messages: [{ role: 'user', content: 'ping' }],
  })
  return !!response.choices[0]?.message?.content
}

// ─── Helpers ────────────────────────────────────────────────────────────────

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

function validateStatus(status) {
  const valid = ['SIGNED', 'UNSIGNED', 'DUBIOUS', 'PENDING']
  return valid.includes(status) ? status : 'DUBIOUS'
}

export { analyzeCouponImage, analyzeImage, testOpenAI }
