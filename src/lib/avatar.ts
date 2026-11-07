const MAX_FILE_BYTES = 10 * 1024 * 1024
const MAX_DATA_URL_LENGTH = 48_000

function renderAvatar(
  bitmap: ImageBitmap,
  size: number,
  quality: number,
): string {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('This browser could not prepare the picture.')
  }

  const sourceSize = Math.min(bitmap.width, bitmap.height)
  const sourceX = (bitmap.width - sourceSize) / 2
  const sourceY = (bitmap.height - sourceSize) / 2

  context.drawImage(
    bitmap,
    sourceX,
    sourceY,
    sourceSize,
    sourceSize,
    0,
    0,
    size,
    size,
  )

  return canvas.toDataURL('image/webp', quality)
}

export async function prepareAvatar(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Choose an image file.')
  }

  if (file.size > MAX_FILE_BYTES) {
    throw new Error('Choose an image smaller than 10 MB.')
  }

  let bitmap: ImageBitmap

  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error('That image could not be opened.')
  }

  try {
    const attempts = [
      { size: 256, quality: 0.82 },
      { size: 256, quality: 0.68 },
      { size: 192, quality: 0.72 },
      { size: 192, quality: 0.58 },
      { size: 128, quality: 0.62 },
    ]

    for (const attempt of attempts) {
      const dataUrl = renderAvatar(
        bitmap,
        attempt.size,
        attempt.quality,
      )

      if (dataUrl.length <= MAX_DATA_URL_LENGTH) {
        return dataUrl
      }
    }
  } finally {
    bitmap.close()
  }

  throw new Error(
    'That picture is still too large after resizing. Try a simpler image.',
  )
}
