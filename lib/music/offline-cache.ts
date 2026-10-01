/**
 * Client-side offline preflight cache for approved stage music.
 * Stores ArrayBuffers in IndexedDB keyed by versionId + checksum.
 */
import localforage from 'localforage'

const musicCache = localforage.createInstance({
  name: 'yoyo-league',
  storeName: 'music-preflight',
})

export type CachedMusicMeta = {
  versionId: string
  checksum: string | null
  displayFilename: string | null
  cachedAt: string
  byteSize: number
}

export async function cacheMusicBlob(
  versionId: string,
  blob: Blob,
  meta: { checksum: string | null; displayFilename: string | null }
): Promise<CachedMusicMeta> {
  const entry: CachedMusicMeta & { blob: Blob } = {
    versionId,
    checksum: meta.checksum,
    displayFilename: meta.displayFilename,
    cachedAt: new Date().toISOString(),
    byteSize: blob.size,
    blob,
  }
  await musicCache.setItem(versionId, entry)
  const { blob: _b, ...rest } = entry
  return rest
}

export async function getCachedMusic(
  versionId: string
): Promise<(CachedMusicMeta & { blob: Blob }) | null> {
  return (await musicCache.getItem(versionId)) as
    | (CachedMusicMeta & { blob: Blob })
    | null
}

export async function listCachedMusicMeta(): Promise<CachedMusicMeta[]> {
  const out: CachedMusicMeta[] = []
  await musicCache.iterate((value: CachedMusicMeta & { blob?: Blob }) => {
    out.push({
      versionId: value.versionId,
      checksum: value.checksum,
      displayFilename: value.displayFilename,
      cachedAt: value.cachedAt,
      byteSize: value.byteSize,
    })
  })
  return out
}

export async function preflightCacheApproved(
  items: Array<{
    versionId: string
    url: string
    checksum: string | null
    displayFilename: string | null
  }>
): Promise<{
  cached: string[]
  failed: Array<{ versionId: string; error: string }>
}> {
  const cached: string[] = []
  const failed: Array<{ versionId: string; error: string }> = []

  for (const item of items) {
    try {
      const existing = await getCachedMusic(item.versionId)
      if (
        existing &&
        item.checksum &&
        existing.checksum &&
        existing.checksum === item.checksum
      ) {
        cached.push(item.versionId)
        continue
      }
      const res = await fetch(item.url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      await cacheMusicBlob(item.versionId, blob, {
        checksum: item.checksum,
        displayFilename: item.displayFilename,
      })
      cached.push(item.versionId)
    } catch (e) {
      failed.push({
        versionId: item.versionId,
        error: e instanceof Error ? e.message : 'cache failed',
      })
    }
  }

  return { cached, failed }
}
