import cloudinary from 'cloudinary'
import sharp from 'sharp'
import logger from '../utils/logger.js'

cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

/**
 * Upload a buffer to Cloudinary with auto-optimization
 * @param {Buffer} buffer - Image buffer
 * @param {string} folder - Cloudinary folder
 * @param {string} filename - Public ID
 * @returns {Promise<{url: string, publicId: string}>}
 */
async function uploadImage(buffer, folder = 'syna-cupones', filename = null) {
  try {
    // Pre-process with sharp: normalize orientation, ensure JPEG
    let processedBuffer
    try {
      processedBuffer = await sharp(buffer)
        .rotate() // Auto-rotate based on EXIF
        .jpeg({ quality: 90, progressive: true })
        .toBuffer()
    } catch {
      // If sharp fails, use original buffer
      processedBuffer = buffer
    }

    return new Promise((resolve, reject) => {
      const uploadOptions = {
        folder,
        resource_type: 'image',
        use_filename: !!filename,
        public_id: filename || undefined,
        unique_filename: !filename,
        overwrite: false,
        transformation: [
          { quality: 'auto:good' },
          { fetch_format: 'auto' },
        ],
      }

      cloudinary.v2.uploader
        .upload_stream(uploadOptions, (error, result) => {
          if (error) {
            logger.error('Cloudinary upload failed', { error: error.message })
            reject(error)
          } else {
            resolve({ url: result.secure_url, publicId: result.public_id })
          }
        })
        .end(processedBuffer)
    })
  } catch (err) {
    logger.error('uploadImage error', { error: err.message })
    throw err
  }
}

async function uploadPDF(buffer, folder = 'syna-cupones/pdfs', filename = null) {
  return new Promise((resolve, reject) => {
    cloudinary.v2.uploader
      .upload_stream(
        {
          folder,
          resource_type: 'raw',
          public_id: filename || undefined,
          unique_filename: !filename,
        },
        (error, result) => {
          if (error) reject(error)
          else resolve({ url: result.secure_url, publicId: result.public_id })
        }
      )
      .end(buffer)
  })
}

/**
 * Delete a file from Cloudinary
 */
async function deleteFile(publicId, resourceType = 'image') {
  try {
    await cloudinary.v2
}

/**
 * Get optimized URL for display
 */
function getOptimizedUrl(url, width = 800) {
  if (!url || !url.includes('cloudinary.com')) return url
  return url.replace('/upload/', `/upload/w_${width},q_auto,f_auto/`)
}

module.exports = { uploadImage, uploadPDF, deleteFile, getOptimizedUrl }
export