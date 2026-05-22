import OpenAI from 'openai'
import logger from '../utils/logger.js'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const ANALYSIS_PROMPT = `Eres un experto en análisis de cupones de tarjetas de crédito y débito argentinos.

Analiza esta imagen de cupón(es) y extrae la información de CADA cupón visible.

Para CADA cupón encontrado, devuelve un JSON con esta estructura exacta:
{
  "coupons": [
    {
      "couponNumber": "número de cupón o null",
      "amount": número decimal o null,
      "installments": número entero de cuotas o null,
      "cardType": "VISA/MASTERCARD/AMEX/NARANJA/CABAL/MAESTRO/otro o null",
      "authCode": "código de autorización o null",
      "merchant": "nombre del comercio o null",
      "couponDate": "fecha en formato YYYY-MM-DD o null",
      "signatureStatus": "SIGNED/UNSIGNED/DUBIOUS",
      "confidence": número entre 0 y 1,
      "signatureNotes": "descripción breve del estado de la firma"
    }
  ],
  "imageQuality": "GOOD/BLURRY/ROTATED/PARTIAL",
  "totalCoupons": número de cupones detectados
}

REGLAS para signatureStatus:
- SIGNED: hay firma claramente visible en el espacio destinado
- UNSIGNED: el espacio de firma está vacío o en blanco
- DUBIOUS: firma dudosa, ilegible, muy débil, o imagen no permite determinarlo con certeza

REGLAS para confidence:
- 0.9-1.0: datos muy claros y legibles
- 0.7-0.9: datos mayormente legibles con alguna duda menor
- 0.5-0.7: imagen de calidad regular, varios campos dudosos
- 0.0-0.5: imagen de mala calidad, muchos campos inciertos

Responde SOLO con el JSON, sin texto adicional ni markdown.`

/**
 * Analyze a single coupon image via OpenAI Vision API
 * @param {string} imageUrl - Cloudinary URL of the image
 * @param {string} model - OpenAI model to use
 * @returns {Promise<Array>} Array of analyzed coupons
 */
async function analyzeCouponImage(imageUrl, model = 'gpt-4o') {
  const MAX_RETRIES = 3
  let lastError

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      logger.info(`Analyzing image (attempt ${attempt}/${MAX_RETRIES})`, { imageUrl: imageUrl.slice(0, 60) })

      const response = await openai.chat.completions.create({
        model,
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl,
                  detail: 'high',
                },
              },
              {
                type: 'text',
                text: ANALYSIS_PROMPT,
              },
            ],
          },
        ],
        response_format: { type: 'json_object' },
      })

      const content = response.choices[0]?.message?.content
      if (!content) throw new Error('Empty response from OpenAI')

      const parsed = JSON.parse(content)

      if (!parsed.coupons || !Array.isArray(parsed.coupons)) {
        throw new Error('Invalid response structure from AI')
      }

      logger.info(`AI analysis complete`, {
        totalCoupons: parsed.totalCoupons,
        imageQuality: parsed.imageQuality,
      })

      return parsed.coupons.map((coupon) => ({
        couponNumber: coupon.couponNumber || null,
        amount: coupon.amount ? parseFloat(coupon.amount) : null,
        installments: coupon.installments ? parseInt(coupon.installments) : null,
        cardType: coupon.cardType || null,
        authCode: coupon.authCode || null,
        merchant: coupon.merchant || null,
        couponDate: coupon.couponDate ? new Date(coupon.couponDate) : null,
        signatureStatus: validateStatus(coupon.signatureStatus),
        aiConfidence: parseFloat(coupon.confidence) || 0.5,
        aiRawResponse: coupon,
      }))
    } catch (err) {
      lastError = err
      logger.error(`AI analysis attempt ${attempt} failed`, { error: err.message })

      if (attempt < MAX_RETRIES) {
        // Exponential backoff
        await new Promise((r) => setTimeout(r, 1000 * attempt))
      }
    }
  }

  // All retries failed — return a pending placeholder
  logger.error('AI analysis failed after all retries', { error: lastError?.message })
  return [
    {
      signatureStatus: 'DUBIOUS',
      aiConfidence: 0,
      aiRawResponse: { error: lastError?.message },
    },
  ]
}

/**
 * Analyze a single image and return structured data (used for reanalysis)
 */
async function analyzeImage(imageUrl) {
  const results = await analyzeCouponImage(imageUrl)
  return results[0] || { signatureStatus: 'DUBIOUS', confidence: 0 }
}

/**
 * Test OpenAI connection
 */
async function testOpenAI() {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 10,
    messages: [{ role: 'user', content: 'ping' }],
  })
  return !!response.choices[0]?.message?.content
}

function validateStatus(status) {
  const valid = ['SIGNED', 'UNSIGNED', 'DUBIOUS', 'PENDING']
  return valid.includes(status) ? status : 'DUBIOUS'
}

export { analyzeCouponImage, analyzeImage, testOpenAI }
