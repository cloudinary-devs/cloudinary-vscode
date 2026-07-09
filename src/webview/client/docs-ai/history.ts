// @ts-nocheck

import { state, $, escapeHtml, timeAgo, callbacks } from "./state"
import { dbSaveConversation } from "./db"
import { loadConversation, deleteConversation, renderTabBar, persistTabState, confirmClearAllChats } from "./tabs"

let historySearch = ''
let renamingId = null

export function groupConversationsByDate(convs) {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const yesterdayStart = todayStart - 86400000
  const weekStart = todayStart - 6 * 86400000

  const groups = []
  const today = [], yesterday = [], week = [], older = []

  for (const c of convs) {
    if (c.updatedAt >= todayStart) {today.push(c)}
    else if (c.updatedAt >= yesterdayStart) {yesterday.push(c)}
    else if (c.updatedAt >= weekStart) {week.push(c)}
    else {older.push(c)}
  }

  if (today.length) {groups.push({ label: 'Today', items: today })}
  if (yesterday.length) {groups.push({ label: 'Yesterday', items: yesterday })}
  if (week.length) {groups.push({ label: 'Previous 7 days', items: week })}
  if (older.length) {groups.push({ label: 'Older', items: older })}
  return groups
}

export function toggleHistoryDropdown() {
  state.historyOpen = !state.historyOpen
  historySearch = ''
  renamingId = null
  renderHistoryDropdown()
}

export function renderHistoryDropdown() {
  const dropdown = $('#history-dropdown')
  if (!dropdown) {return}

  if (!state.historyOpen) {
    dropdown.style.display = 'none'
    return
  }

  dropdown.style.display = 'flex'

  const filtered = historySearch
    ? state.conversations.filter(c => c.title.toLowerCase().includes(historySearch.toLowerCase()))
    : state.conversations

  let bodyHtml = ''

  if (filtered.length === 0) {
    bodyHtml = `<div class="history-empty">${historySearch ? 'No matching chats' : 'No previous chats'}</div>`
  } else {
    const groups = groupConversationsByDate(filtered)
    bodyHtml = groups.map(g => `
      <div class="history-group">
        <div class="history-group-label">${g.label}</div>
        ${g.items.map(c => renderHistoryItem(c)).join('')}
      </div>
    `).join('')
  }

  const clearAllHtml = state.conversations.length > 0 ? `
    <div class="history-footer">
      <button id="history-clear-all" class="history-clear-all" type="button">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        <span>Clear all chats</span>
      </button>
    </div>
  ` : ''

  dropdown.innerHTML = `
    <div class="history-search-row">
      <input id="history-search" class="history-search" type="text" placeholder="Search..." value="${escapeHtml(historySearch)}" />
    </div>
    <div class="history-list">${bodyHtml}</div>
    ${clearAllHtml}
  `

  attachDropdownListeners()

  const searchEl = dropdown.querySelector('#history-search')
  if (searchEl && !historySearch) {searchEl.focus()}
}

function renderHistoryItem(c) {
  const isActive = c.id === state.currentConversationId
  const isRenaming = c.id === renamingId

  if (isRenaming) {
    return `
      <div class="history-item active" data-conv-id="${c.id}">
        <input class="history-rename-input" data-conv-id="${c.id}" type="text" value="${escapeHtml(c.title)}" />
        <button class="history-action history-rename-confirm" data-conv-id="${c.id}" title="Save">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </button>
      </div>`
  }

  return `
    <div class="history-item ${isActive ? 'active' : ''}" data-conv-id="${c.id}">
      <span class="history-title">${escapeHtml(c.title)}</span>
      <span class="history-time">${timeAgo(c.updatedAt)}</span>
      <div class="history-actions">
        <button class="history-action history-rename-btn" data-conv-id="${c.id}" title="Rename">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        </button>
        <button class="history-action history-delete" data-conv-id="${c.id}" title="Delete">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </button>
      </div>
    </div>`
}

function attachDropdownListeners() {
  const dropdown = $('#history-dropdown')
  if (!dropdown) {return}

  const searchInput = dropdown.querySelector('#history-search')
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      historySearch = e.target.value
      renderHistoryDropdown()
      const newInput = $('#history-search')
      if (newInput) { newInput.focus(); newInput.selectionStart = newInput.selectionEnd = newInput.value.length }
    })
  }

  dropdown.querySelector('#history-clear-all')?.addEventListener('click', (e) => {
    e.stopPropagation()
    confirmClearAllChats()
  })

  dropdown.querySelectorAll('.history-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('.history-action') || e.target.closest('.history-rename-input')) {return}
      loadConversation(item.dataset.convId)
    })
  })

  dropdown.querySelectorAll('.history-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      deleteConversation(btn.dataset.convId)
    })
  })

  dropdown.querySelectorAll('.history-rename-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      renamingId = btn.dataset.convId
      renderHistoryDropdown()
      const renameInput = dropdown.querySelector(`.history-rename-input[data-conv-id="${renamingId}"]`)
      if (renameInput) { renameInput.focus(); renameInput.select() }
    })
  })

  dropdown.querySelectorAll('.history-rename-confirm').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const input = dropdown.querySelector(`.history-rename-input[data-conv-id="${btn.dataset.convId}"]`)
      if (input) {confirmRename(btn.dataset.convId, input.value)}
    })
  })

  dropdown.querySelectorAll('.history-rename-input').forEach(input => {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        confirmRename(input.dataset.convId, input.value)
      } else if (e.key === 'Escape') {
        renamingId = null
        renderHistoryDropdown()
      }
    })
  })
}

export async function confirmRename(id, newTitle) {
  const title = newTitle.trim()
  if (!title) {return}
  const conv = state.conversations.find(c => c.id === id)
  if (conv) {
    conv.title = title
    try { await dbSaveConversation(conv) } catch (e) { console.error('Failed to rename conversation:', e) }
  }
  const tab = state.openTabs.find(t => t.conversationId === id)
  if (tab) {tab.title = title}
  renamingId = null
  renderHistoryDropdown()
  renderTabBar()
  callbacks.syncRecentConversations()
  persistTabState()
}
