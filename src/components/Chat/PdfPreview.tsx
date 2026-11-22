"use client"

import { useState } from 'react'
import { getPdfPreviewUrl } from '@/lib/cloudinary-media'

type PdfPreviewProps = {
  src: string
  title: string
  className: string
}

export default function PdfPreview({ src, title, className }: PdfPreviewProps) {
  const imagePreviewUrl = getPdfPreviewUrl(src)
  const [imagePreviewFailed, setImagePreviewFailed] = useState(false)

  if (imagePreviewUrl && !imagePreviewFailed) {
    return (
      <img
        src={imagePreviewUrl}
        alt={`${title} — first page preview`}
        className={`${className} object-contain`}
        onError={() => setImagePreviewFailed(true)}
      />
    )
  }

  return <iframe src={src} title={title} className={className} loading="lazy" />
}
