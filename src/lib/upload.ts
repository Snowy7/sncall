export type UploadedAttachment = {
  storageId: string
  name: string
  contentType: string
  size: number
  width?: number
  height?: number
}

export async function uploadFile(
  uploadUrl: string,
  file: File,
): Promise<UploadedAttachment> {
  const dims = file.type.startsWith("image/") ? await readImageDims(file) : null
  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  })
  if (!res.ok) throw new Error(`Upload failed (${res.status})`)
  const { storageId } = (await res.json()) as { storageId: string }
  return {
    storageId,
    name: file.name,
    contentType: file.type || "application/octet-stream",
    size: file.size,
    width: dims?.width,
    height: dims?.height,
  }
}

function readImageDims(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    img.src = url
  })
}

export const MAX_ATTACHMENTS = 6
export const MAX_FILE_SIZE = 10 * 1024 * 1024
