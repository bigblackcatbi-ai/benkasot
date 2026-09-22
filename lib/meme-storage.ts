import type { Meme } from '@/types/meme'

// Custom memes live only in the user's browser via IndexedDB. There is no
// backend, no upload, and no sharing between browsers. Built-in memes are never
// written here — this store holds user-created memes plus a tiny preference
// record listing which built-in ids the user removed.
const DB_NAME = 'BENKASOT_DB'
const DB_VERSION = 1
const MEME_STORE = 'customMemes'
const META_STORE = 'meta'
const DELETED_KEY = 'deletedBuiltInIds'

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this browser.'))
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(MEME_STORE)) {
        db.createObjectStore(MEME_STORE, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE)
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Could not open local meme storage.'))
    request.onblocked = () => reject(new Error('Local meme storage is blocked by another open tab.'))
  })

  // Allow a later retry if opening failed (private mode, quota, blocked, etc.).
  dbPromise.catch(() => {
    dbPromise = null
  })

  return dbPromise
}

export async function loadAllCustomMemes(): Promise<Meme[]> {
  const db = await openDb()
  return new Promise<Meme[]>((resolve, reject) => {
    const request = db.transaction(MEME_STORE, 'readonly').objectStore(MEME_STORE).getAll()
    request.onsuccess = () => resolve((request.result ?? []) as Meme[])
    request.onerror = () => reject(request.error ?? new Error('Could not read custom memes.'))
  })
}

export async function putCustomMeme(meme: Meme): Promise<void> {
  const db = await openDb()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(MEME_STORE, 'readwrite')
    tx.objectStore(MEME_STORE).put(meme)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Could not save the meme.'))
    tx.onabort = () => reject(tx.error ?? new Error('Could not save the meme.'))
  })
}

export async function deleteCustomMeme(id: string): Promise<void> {
  const db = await openDb()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(MEME_STORE, 'readwrite')
    tx.objectStore(MEME_STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Could not delete the meme.'))
    tx.onabort = () => reject(tx.error ?? new Error('Could not delete the meme.'))
  })
}

export async function loadDeletedIds(): Promise<string[]> {
  const db = await openDb()
  return new Promise<string[]>((resolve, reject) => {
    const request = db.transaction(META_STORE, 'readonly').objectStore(META_STORE).get(DELETED_KEY)
    request.onsuccess = () => resolve(Array.isArray(request.result) ? (request.result as string[]) : [])
    request.onerror = () => reject(request.error ?? new Error('Could not read meme preferences.'))
  })
}

export async function saveDeletedIds(ids: string[]): Promise<void> {
  const db = await openDb()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(META_STORE, 'readwrite')
    tx.objectStore(META_STORE).put(ids, DELETED_KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Could not save meme preferences.'))
    tx.onabort = () => reject(tx.error ?? new Error('Could not save meme preferences.'))
  })
}
