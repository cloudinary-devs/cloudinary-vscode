// @ts-nocheck

const DB_NAME = 'CloudinaryVSCodeChatDB'
const DB_VERSION = 2

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (e) => {
      const db = e.target.result
      const oldVersion = e.oldVersion
      if (oldVersion < 1) {
        const convStore = db.createObjectStore('conversations', { keyPath: 'id' })
        convStore.createIndex('updatedAt', 'updatedAt', { unique: false })
        const msgStore = db.createObjectStore('messages', { keyPath: 'id' })
        msgStore.createIndex('conversationId', 'conversationId', { unique: false })
      }
      if (oldVersion < 2) {
        db.createObjectStore('tabState', { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function dbGetAllConversations() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('conversations', 'readonly')
    const req = tx.objectStore('conversations').getAll()
    req.onsuccess = () => {
      const list = req.result || []
      list.sort((a, b) => b.updatedAt - a.updatedAt)
      resolve(list)
    }
    req.onerror = () => reject(req.error)
  })
}

export async function dbGetMessages(conversationId) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('messages', 'readonly')
    const req = tx.objectStore('messages').index('conversationId').getAll(conversationId)
    req.onsuccess = () => {
      const list = req.result || []
      list.sort((a, b) => a.createdAt - b.createdAt)
      resolve(list)
    }
    req.onerror = () => reject(req.error)
  })
}

export async function dbSaveConversation(conv) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('conversations', 'readwrite')
    tx.objectStore('conversations').put(conv)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function dbSaveMessage(msg) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('messages', 'readwrite')
    tx.objectStore('messages').put(msg)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function dbDeleteConversation(id) {
  const db = await openDB()
  await new Promise((resolve, reject) => {
    const tx = db.transaction('conversations', 'readwrite')
    tx.objectStore('conversations').delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  const msgs = await dbGetMessages(id)
  if (msgs.length > 0) {
    const db2 = await openDB()
    await new Promise((resolve, reject) => {
      const tx = db2.transaction('messages', 'readwrite')
      const store = tx.objectStore('messages')
      for (const m of msgs) {store.delete(m.id)}
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }
}

export async function dbClearChatState() {
  const db = await openDB()
  const stores = ['conversations', 'messages', 'tabState'].filter(storeName => db.objectStoreNames.contains(storeName))
  if (stores.length === 0) {return}

  await new Promise((resolve, reject) => {
    const tx = db.transaction(stores, 'readwrite')
    for (const storeName of stores) {
      tx.objectStore(storeName).clear()
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function dbDeleteMessagesAfter(conversationId, createdAtCutoff) {
  const msgs = await dbGetMessages(conversationId)
  const toDelete = msgs.filter(m => m.createdAt > createdAtCutoff)
  if (toDelete.length === 0) {return}
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('messages', 'readwrite')
    const store = tx.objectStore('messages')
    for (const m of toDelete) {store.delete(m.id)}
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function dbSaveTabState(tabState) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tabState', 'readwrite')
    tx.objectStore('tabState').put({ id: 'current', ...tabState })
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function dbLoadTabState() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tabState', 'readonly')
    const req = tx.objectStore('tabState').get('current')
    req.onsuccess = () => resolve(req.result || null)
    req.onerror = () => reject(req.error)
  })
}
