import { v2 as cloudinary } from 'cloudinary'
import sharp from 'sharp'
import logger from '../utils/logger.js'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

/**
 * Upload an image buffer to Cloudinary with EXIF rotation fix and JPEG normalization.
 */
async function uploadImage(buffer, folder = 'syna-cupones/images') {
  let processedBuffer
  try {
    processedBuffer = await sharp(buffer)
      .rotate()                               // Auto-rotate based on EXIF orientation
      .jpeg({ quality: 90, progressive: true })
      .toBuffer()
  } catch {
    processedBuffer = buffer                  // If sharp fails, use original
  }

  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder,
          resource_type: 'image',
          unique_filename: true,
          overwrite: false,
          transformation: [{ quality: 'auto:good' }, { fetch_format: 'auto' }],
        },
        (error, result) => {
          if (error) {
            logger.error('Cloudinary image upload failed', { error: error.message })
            reject(error)
          } else {
            resolve({ url: result.secure_url, publicId: result.public_id })
          }
        }
      )
      .end(processedBuffer)
  })
}

/**
 * Upload a PDF to Cloudinary as resource_type 'image' so Cloudinary
 * automatically renders each page and makes them accessible via pg_{n} URLs.
 * Returns pageCount from the Cloudinary response.
 */
async function uploadPDF(buffer, folder = 'syna-cupones/pdfs') {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder,
          resource_type: 'image',  // Cloudinary processes PDF pages when resource_type=image
          format: 'jpg',
          unique_filename: true,
          overwrite: false,
        },
        (error, result) => {
          if (error) {
            logger.error('Cloudinary PDF upload failed', { error: error.message })
            reject(error)
          } else {
            resolve({
              url: result.secure_url,
              publicId: result.public_id,
              pageCount: result.pages || 1,
            })
          }
        }
      )
      .end(buffer)
  })
}

/**
 * Build the Cloudinary image URL for a specific PDF page.
 * Cloudinary uses pg_{n} transformation for multi-page PDFs.
 * Page numbers are 1-based.
 */
function getPdfPageUrl(publicId, pageNumber = 1) {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME
  // Strip any .jpg extension already in publicId to avoid double extension
  const cleanId = publicId.replace(/\.jpg$/, '')
  return `https://res.cloudinary.com/${cloud}/image/upload/pg_${pageNumber}/${cleanId}.jpg`
}

/**
 * Return an optimized URL for display (resized + auto format/quality).
 */
function getOptimizedUrl(url, width = 800) {
  if (!url || !url.includes('cloudinary.com')) return url
  return url.replace('/upload/', `/upload/w_${width},q_auto,f_auto/`)
}

/**
 * Delete a file from Cloudinary by publicId.
 */
async function deleteFile(publicId, resourceType = 'image') {
  try {
    const result = await cloudinary.uploader.destroy(publicId, { resource_type: resourceType })
    logger.info('Cloudinary file deleted', { publicId, result: result.result })
    return result
  } catch (err) {
    logger.error('Cloudinary delete failed', { publicId, error: err.message })
    throw err
  }
}

export { uploadImage, uploadPDF, getPdfPageUrl, getOptimizedUrl, deleteFile }
