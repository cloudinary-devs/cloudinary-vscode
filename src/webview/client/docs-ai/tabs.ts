// @ts-nocheck

import { state, tabMessagesCache, tabStreamState, $, escapeHtml, tabId, callbacks } from "./state"
import { dbGetMessages, dbSaveConversation, dbSaveMessage, dbDeleteConversation, dbGetAllConversations, dbSaveTabState, dbClearChatState } from "./db"

const MAX_CONVERSATIONS = 50

function showClearChatsConfirmation(onConfirm) {
  document.querySelector('.docs-ai-confirm-overlay')?.remove()

  const previouslyFocused = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null
  const overlay = document.createElement('div')
  overlay.className = 'docs-ai-confirm-overlay'
  overlay.setAttribute('role', 'presentation')
  overlay.innerHTML = `
    <div class="docs-ai-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="docs-ai-confirm-title" aria-describedby="docs-ai-confirm-message">
      <h2 id="docs-ai-confirm-title" class="docs-ai-confirm-title">Delete all conversations?</h2>
      <p id="docs-ai-confirm-message" class="docs-ai-confirm-message">This will permanently remove all chat history.</p>
      <div class="docs-ai-confirm-actions">
        <button class="docs-ai-confirm-btn docs-ai-confirm-cancel" type="button">Cancel</button>
        <button class="docs-ai-confirm-btn docs-ai-confirm-delete" type="button">Delete All</button>
      </div>
    </div>
  `

  const cancelButton = overlay.querySelector('.docs-ai-confirm-cancel')
  const deleteButton = overlay.querySelector('.docs-ai-confirm-delete')
  if (!cancelButton || !deleteButton) {return}

  function close() {
    document.removeEventListener('keydown', handleKeydown)
    overlay.remove()
    previouslyFocused?.focus()
  }

  function handleKeydown(event) {
    if (event.key === 'Escape') {
      close()
    }
  }

  cancelButton.addEventListener('click', close)
  deleteButton.addEventListener('click', () => {
    close()
    onConfirm()
  })
  overlay.addEventListener('mousedown', (event) => {
    if (event.target === overlay) {
      close()
    }
  })

  document.body.appendChild(overlay)
  document.addEventListener('keydown', handleKeydown)
  requestAnimationFrame(() => overlay.classList.add('is-visible'))
  cancelButton.focus()
}

// --- Persistence helpers ---

export async function persistMessage(msg) {
  if (!state.currentConversationId) {return}
  try {
    await dbSaveMessage({ ...msg, conversationId: state.currentConversationId, streaming: false })
  } catch (e) {
    console.error('Failed to persist message:', e)
  }
}

export async function updateConversationTimestamp() {
  if (!state.currentConversationId) {return}
  const conv = state.conversations.find(c => c.id === state.currentConversationId)
  if (conv) {
    conv.updatedAt = Date.now()
    try { await dbSaveConversation(conv) } catch (e) { console.error('Failed to update conversation:', e) }
    callbacks.syncRecentConversations()
  }
}

export async function persistTabState() {
  try {
    await dbSaveTabState({ openTabs: state.openTabs, activeTabId: state.activeTabId })
  } catch (e) {
    console.error('Failed to persist tab state:', e)
  }
}

export async function loadConversations() {
  try {
    state.conversations = await dbGetAllConversations()
    await enforceConversationLimit()
    callbacks.syncRecentConversations()
  } catch (e) {
    console.error('Failed to load conversations:', e)
    state.conversations = []
  }
}

export async function enforceConversationLimit() {
  if (state.conversations.length <= MAX_CONVERSATIONS) {return}
  const openConvIds = new Set(state.openTabs.map(t => t.conversationId).filter(Boolean))
  const toRemove = []
  for (let i = state.conversations.length - 1; i >= 0 && state.conversations.length - toRemove.length > MAX_CONVERSATIONS; i--) {
    if (!openConvIds.has(state.conversations[i].id)) {toRemove.push(state.conversations[i].id)}
  }
  for (const id of toRemove) {
    try { await dbDeleteConversation(id) } catch (_) {}
    state.conversations = state.conversations.filter(c => c.id !== id)
  }
  callbacks.syncRecentConversations()
}

// --- Tab management ---

export function createTab(conversationId, title) {
  const id = tabId()
  const tab = { id, conversationId, title: title || 'New Chat' }
  state.openTabs.push(tab)
  state.activeTabId = id
  return tab
}

export async function switchTab(tid) {
  if (tid === state.activeTabId) {return}

  tabMessagesCache.set(state.activeTabId, state.messages)

  state.activeTabId = tid
  const tab = state.openTabs.find(t => t.id === tid)
  if (!tab) {return}

  const streamState = tabStreamState.get(tid)

  if (tabMessagesCache.has(tid)) {
    state.messages = tabMessagesCache.get(tid)
    state.currentConversationId = tab.conversationId
  } else if (tab.conversationId) {
    try {
      const msgs = await dbGetMessages(tab.conversationId)
      state.messages = msgs.map(m => ({ ...m, streaming: false }))
      state.currentConversationId = tab.conversationId
    } catch (e) {
      console.error('Failed to load tab conversation:', e)
      state.messages = []
      state.currentConversationId = null
    }
  } else {
    state.messages = []
    state.currentConversationId = null
  }

  state.streaming = streamState?.streaming || false
  state.loading = streamState?.loading || false
  state.abortController = streamState?.abortController || null

  state.historyOpen = false
  renderTabBar()
  callbacks.render()
  callbacks.renderHistoryDropdown()
  persistTabState()
}

export function closeTab(tid) {
  const idx = state.openTabs.findIndex(t => t.id === tid)
  if (idx === -1) {return}

  const streamState = tabStreamState.get(tid)
  if (streamState?.abortController) {
    streamState.abortController.abort()
    tabStreamState.delete(tid)
  }
  tabMessagesCache.delete(tid)

  if (tid === state.activeTabId) {
    state.streaming = false
    state.loading = false
    state.abortController = null
  }

  state.openTabs.splice(idx, 1)

  if (state.openTabs.length === 0) {
    createTab(null, 'New Chat')
    state.messages = []
    state.currentConversationId = null
    renderTabBar()
    callbacks.render()
    persistTabState()
    return
  }

  if (tid === state.activeTabId) {
    const newIdx = Math.min(idx, state.openTabs.length - 1)
    switchTab(state.openTabs[newIdx].id)
  } else {
    renderTabBar()
    persistTabState()
  }
}

export function newChat() {
  const existingNew = state.openTabs.find(t => !t.conversationId)
  if (existingNew && state.activeTabId !== existingNew.id) {
    switchTab(existingNew.id)
    return
  }
  if (existingNew && state.activeTabId === existingNew.id && state.messages.length === 0) {return}

  if (state.activeTabId) {tabMessagesCache.set(state.activeTabId, state.messages)}

  createTab(null, 'New Chat')
  state.currentConversationId = null
  state.messages = []
  state.streaming = false
  state.loading = false
  state.abortController = null
  state.historyOpen = false
  renderTabBar()
  callbacks.render()
  callbacks.renderHistoryDropdown()
  persistTabState()
}

export async function loadConversation(cid) {
  const existingTab = state.openTabs.find(t => t.conversationId === cid)
  if (existingTab) {
    const conv = state.conversations.find(c => c.id === cid)
    if (conv) {
      const now = Date.now()
      const createdAt = Number(conv.createdAt || now)
      const updatedAt = Number(conv.updatedAt || createdAt)
      callbacks.trackAnalytics('conversation_resumed', {
        conversation_id: conv.id,
        age_since_created_hours: Math.max(0, Math.round((now - createdAt) / 36_000) / 100),
        age_since_last_message_hours: Math.max(0, Math.round((now - updatedAt) / 36_000) / 100),
      })
    }
    await switchTab(existingTab.id)
    return
  }

  if (state.activeTabId) {tabMessagesCache.set(state.activeTabId, state.messages)}

  try {
    const msgs = await dbGetMessages(cid)
    state.messages = msgs.map(m => ({ ...m, streaming: false }))
    state.currentConversationId = cid

    const conv = state.conversations.find(c => c.id === cid)
    const title = conv ? conv.title : 'Chat'
    if (conv) {
      const now = Date.now()
      const createdAt = Number(conv.createdAt || now)
      const updatedAt = Number(conv.updatedAt || createdAt)
      callbacks.trackAnalytics('conversation_resumed', {
        conversation_id: conv.id,
        age_since_created_hours: Math.max(0, Math.round((now - createdAt) / 36_000) / 100),
        age_since_last_message_hours: Math.max(0, Math.round((now - updatedAt) / 36_000) / 100),
      })
    }

    const activeTab = state.openTabs.find(t => t.id === state.activeTabId)
    if (activeTab && !activeTab.conversationId && state.messages.length === 0) {
      activeTab.conversationId = cid
      activeTab.title = title
    } else {
      createTab(cid, title)
    }

    state.historyOpen = false
    renderTabBar()
    callbacks.render()
    callbacks.renderHistoryDropdown()
    persistTabState()
  } catch (e) {
    console.error('Failed to load conversation:', e)
  }
}

export async function clearAllChats() {
  state.abortController?.abort()
  for (const streamState of tabStreamState.values()) {
    streamState.abortController?.abort()
  }

  tabStreamState.clear()
  tabMessagesCache.clear()

  try {
    await dbClearChatState()
  } catch (e) {
    console.error('Failed to clear conversations:', e)
    return
  }

  state.conversations = []
  state.openTabs = []
  createTab(null, 'New Chat')
  state.currentConversationId = null
  state.messages = []
  state.streaming = false
  state.loading = false
  state.abortController = null
  state.historyOpen = false

  renderTabBar()
  callbacks.render()
  callbacks.renderHistoryDropdown()
  callbacks.syncRecentConversations()
  persistTabState()
}

export function confirmClearAllChats() {
  if (state.conversations.length === 0) {return}
  showClearChatsConfirmation(() => {
    clearAllChats()
  })
}

let undoTimeout = null

function showUndoToast(message, onUndo) {
  dismissUndoToast()
  const toast = document.createElement('div')
  toast.className = 'undo-toast'
  toast.innerHTML = `<span>${message}</span><button class="undo-btn">Undo</button>`
  document.body.appendChild(toast)
  toast.querySelector('.undo-btn').addEventListener('click', () => {
    dismissUndoToast()
    onUndo()
  })
  requestAnimationFrame(() => toast.classList.add('visible'))
  undoTimeout = setTimeout(dismissUndoToast, 5000)
}

function dismissUndoToast() {
  clearTimeout(undoTimeout)
  undoTimeout = null
  const existing = document.querySelector('.undo-toast')
  if (existing) {existing.remove()}
}

export async function deleteConversation(id) {
  const conv = state.conversations.find(c => c.id === id)
  const convMessages = conv ? await dbGetMessages(id).catch(() => []) : []
  const convIndex = state.conversations.indexOf(conv)

  try {
    await dbDeleteConversation(id)
    state.conversations = state.conversations.filter(c => c.id !== id)

    const affectedTabs = state.openTabs.filter(t => t.conversationId === id)
    for (const tab of affectedTabs) {
      tab.conversationId = null
      tab.title = 'New Chat'
    }

    if (state.currentConversationId === id) {
      state.currentConversationId = null
      state.messages = []
      callbacks.render()
    }

    renderTabBar()
    callbacks.renderHistoryDropdown()
    callbacks.syncRecentConversations()
    persistTabState()

    if (conv) {
      showUndoToast('Chat deleted', async () => {
        try {
          await dbSaveConversation(conv)
          for (const m of convMessages) {await dbSaveMessage(m)}
          state.conversations.splice(Math.min(convIndex, state.conversations.length), 0, conv)
          state.conversations.sort((a, b) => b.updatedAt - a.updatedAt)
          callbacks.renderHistoryDropdown()
          callbacks.syncRecentConversations()
        } catch (e) { console.error('Failed to undo delete:', e) }
      })
    }
  } catch (e) {
    console.error('Failed to delete conversation:', e)
  }
}

// --- Tab bar rendering ---

export function renderTabBar() {
  const bar = $('#tab-bar')
  if (!bar) {return}

  const scrollArea = bar.querySelector('.tab-scroll')
  if (!scrollArea) {return}

  scrollArea.innerHTML = state.openTabs.map(t => `
    <div class="tab-item ${t.id === state.activeTabId ? 'active' : ''}" data-tab-id="${t.id}" title="${escapeHtml(t.title)}">
      <span class="tab-title">${escapeHtml(t.title)}</span>
      <button class="tab-close" data-tab-id="${t.id}" title="Close">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  `).join('')

  scrollArea.querySelectorAll('.tab-item').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.tab-close')) {return}
      switchTab(el.dataset.tabId)
    })
  })

  scrollArea.querySelectorAll('.tab-close').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      closeTab(btn.dataset.tabId)
    })
  })
}
