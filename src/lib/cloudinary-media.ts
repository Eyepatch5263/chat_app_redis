const CLOUDINARY_HOST = 'res.cloudinary.com'

function parseCloudinaryUrl(url: string): URL | null {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' || parsed.hostname !== CLOUDINARY_HOST) return null
    return parsed
  } catch {
    return null
  }
}

export function getPdfPreviewUrl(url: string): string | null {
  const parsed = parseCloudinaryUrl(url)
  if (!parsed || !parsed.pathname.includes('/image/upload/')) return null
  if (!/\.pdf$/i.test(parsed.pathname)) return null

  parsed.pathname = parsed.pathname.replace(/\.pdf$/i, '.jpg')
  return parsed.toString()
}

export function getPdfDownloadUrl(url: string): string {
  const parsed = parseCloudinaryUrl(url)
  if (!parsed) return url

  const uploadPath = parsed.pathname.match(/\/(image|raw)\/upload\//)
  if (!uploadPath || uploadPath.index === undefined) return url

  const insertionPoint = uploadPath.index + uploadPath[0].length
  const remainingPath = parsed.pathname.slice(insertionPoint)
  if (remainingPath.split('/')[0].startsWith('fl_attachment')) return url

  parsed.pathname = `${parsed.pathname.slice(0, insertionPoint)}fl_attachment/${remainingPath}`
  return parsed.toString()
}
