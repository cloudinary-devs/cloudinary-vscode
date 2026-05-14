// @ts-nocheck

import { renderMarkdown } from "./markdown"
import { dbGetMessages, dbSaveConversation, dbSaveMessage, dbDeleteMessagesAfter, dbGetAllConversations, dbLoadTabState } from "./db"
import {
  API_BASE, API_URL, vscode, state, tabMessagesCache, tabStreamState,
  $, conversationEl, inputEl, scrollToBottom, normalizeSources,
  getSourceUrl, getSourceLabel, escapeHtml, pickStarters,
  uid, convId, timeAgo, callbacks, IDE_PLATFORM, INITIAL_PROMPT, INITIAL_CONVERSATION_ID,
} from "./state"
import {
  persistMessage, updateConversationTimestamp, persistTabState, loadConversations,
  createTab, switchTab, closeTab, newChat, loadConversation, deleteConversation,
  renderTabBar, enforceConversationLimit,
} from "./tabs"
import { toggleHistoryDropdown, renderHistoryDropdown } from "./history"
import { initActionToolbar } from "../actionToolbar"

// Wire up callbacks so tabs.js and history.js can call render/renderHistoryDropdown without circular imports
callbacks.render = render
callbacks.renderHistoryDropdown = renderHistoryDropdown
callbacks.syncRecentConversations = syncRecentConversations

function syncRecentConversations() {
  vscode.postMessage({
    command: 'docsAiRecentConversations',
    conversations: state.conversations.map(c => ({
      id: c.id,
      title: c.title,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    })),
  })
}

async function syncRecentConversationsFromStorage() {
  await loadConversations()
  syncRecentConversations()
}

// --- Feedback helpers ---

function updateFeedbackButtons(actions, msg) {
  if (!actions) {return}
  const upBtn = actions.querySelector('.msg-feedback-up')
  const downBtn = actions.querySelector('.msg-feedback-down')
  if (upBtn) {
    upBtn.classList.toggle('selected', msg.feedback === 'up')
    upBtn.querySelector('svg').setAttribute('fill', msg.feedback === 'up' ? 'currentColor' : 'none')
  }
  if (downBtn) {
    downBtn.classList.toggle('selected', msg.feedback === 'down')
    downBtn.querySelector('svg').setAttribute('fill', msg.feedback === 'down' ? 'currentColor' : 'none')
  }
}

function sendFeedbackToApi(msg, rating, starRating, comment) {
  const idx = state.messages.indexOf(msg)
  const userMsg = [...state.messages.slice(0, idx)].reverse().find(m => m.role === 'user')
  const body = {
    messageId: msg.id,
    conversationId: msg.conversationId || state.currentConversationId,
    platform: IDE_PLATFORM,
    rating,
    messageContent: msg.content || '',
    userMessage: userMsg?.content || '',
  }
  if (starRating) {body.starRating = starRating}
  if (comment) {body.comment = comment}
  fetch(`${API_BASE}/api/feedback`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(err => console.error('Feedback send failed:', err))
}

function closeFeedbackForm(article) {
  const existing = article?.querySelector('.feedback-form')
  if (existing) {existing.remove()}
}

function showFeedbackForm(article, msg) {
  closeFeedbackForm(article)
  const form = document.createElement('div')
  form.className = 'feedback-form'
  let selectedStar = 0

  form.innerHTML = `
    <div class="feedback-form-inner">
      <div class="feedback-form-header">What went wrong?</div>
      <div class="feedback-stars" role="group" aria-label="Rating">
        ${[1,2,3,4,5].map(n => `<button class="feedback-star" data-star="${n}" title="${n} star${n > 1 ? 's' : ''}">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        </button>`).join('')}
      </div>
      <textarea class="feedback-comment" placeholder="Tell us more (optional)..." rows="3"></textarea>
      <div class="feedback-form-actions">
        <button class="feedback-cancel-btn">Cancel</button>
        <button class="feedback-submit-btn">Submit</button>
      </div>
    </div>`

  const actionsEl = article.querySelector('.msg-actions')
  if (actionsEl) {actionsEl.after(form)}
  else {article.appendChild(form)}

  requestAnimationFrame(() => form.scrollIntoView({ behavior: 'smooth', block: 'nearest' }))

  const stars = form.querySelectorAll('.feedback-star')
  const updateStars = () => {
    stars.forEach(s => {
      const v = parseInt(s.dataset.star)
      const svg = s.querySelector('svg')
      s.classList.toggle('active', v <= selectedStar)
      svg.setAttribute('fill', v <= selectedStar ? 'currentColor' : 'none')
    })
  }

  stars.forEach(s => {
    s.addEventListener('click', () => {
      selectedStar = parseInt(s.dataset.star)
      updateStars()
    })
  })

  form.querySelector('.feedback-cancel-btn').addEventListener('click', () => {
    msg.feedback = null
    persistMessage(msg)
    updateFeedbackButtons(article.querySelector('.msg-actions'), msg)
    form.remove()
  })

  form.querySelector('.feedback-submit-btn').addEventListener('click', () => {
    const comment = form.querySelector('.feedback-comment').value.trim()
    sendFeedbackToApi(msg, 'down', selectedStar || undefined, comment || undefined)

    const inner = form.querySelector('.feedback-form-inner')
    inner.innerHTML = `
      <div class="feedback-thankyou">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
        <span>Thanks for your feedback</span>
      </div>`
    setTimeout(() => {
      form.style.opacity = '0'
      form.style.transition = 'opacity 0.2s'
      setTimeout(() => form.remove(), 200)
    }, 1500)
  })
}

// --- Render ---

function render() {
  const conv = conversationEl()
  if (!conv) {return}

  if (state.messages.length === 0) {
    conv.classList.add('empty-state')
    const starters = pickStarters(3)
    const recentConvs = state.conversations.slice(0, 3)
    const recentHtml = recentConvs.length > 0 ? `
      <div class="recent-chats">
        <div class="recent-heading">Recent conversations</div>
        ${recentConvs.map(c => `
          <button class="recent-item" data-conv-id="${c.id}">
            <svg class="recent-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <span class="recent-title">${escapeHtml(c.title)}</span>
            <span class="recent-time">${timeAgo(c.updatedAt || c.createdAt)}</span>
          </button>
        `).join('')}
      </div>` : ''

    conv.innerHTML = `
      <div class="empty">
        <div class="empty-heading">Ask Cloudinary</div>
        <p class="empty-sub">Ask me anything about our products and documentation.</p>
        <div class="empty-input-row">
          <textarea id="empty-input" class="empty-input" rows="1" placeholder="Send a message..." autocomplete="off" dir="auto"></textarea>
          <button id="empty-send-btn" class="empty-send-btn" disabled title="Send message">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
        <div class="chips">
          ${starters.map(q => `<button class="chip" data-question="${q.replace(/"/g, '&quot;')}">${q}</button>`).join('')}
        </div>
      </div>
      ${recentHtml}`

    const emptyInput = conv.querySelector('#empty-input')
    const emptySendBtn = conv.querySelector('#empty-send-btn')

    if (emptyInput) {
      emptyInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          ask(emptyInput.value)
        }
      })
      emptyInput.addEventListener('input', () => {
        emptyInput.style.height = 'auto'
        emptyInput.style.height = Math.min(emptyInput.scrollHeight, 150) + 'px'
        if (emptySendBtn) {emptySendBtn.disabled = !emptyInput.value.trim()}
      })
    }
    if (emptySendBtn) {
      emptySendBtn.addEventListener('click', () => {
        if (emptyInput) {ask(emptyInput.value)}
      })
    }

    conv.querySelectorAll('.chip').forEach(btn => {
      btn.addEventListener('click', () => ask(btn.dataset.question))
    })
    conv.querySelectorAll('.recent-item').forEach(btn => {
      btn.addEventListener('click', () => loadConversation(btn.dataset.convId))
    })
    updateComposer()
    if (emptyInput) {queueMicrotask(() => emptyInput.focus())}
    return
  }

  conv.classList.remove('empty-state')

  const lastAssistantId = [...state.messages].reverse().find(m => m.role === 'assistant')?.id

  conv.innerHTML = state.messages.map(m => {
    let bubbleContent = ''
    if (m.role === 'assistant') {
      if (m.content) {
        bubbleContent = `<div class="md" dir="auto">${renderMarkdown(m.content)}</div>`
      } else {
        bubbleContent = '<p class="muted">Thinking...</p>'
      }
      if (m.streaming) {bubbleContent += '<span class="cursor">|</span>'}
    } else {
      bubbleContent = `<p dir="auto">${escapeHtml(m.content)}</p>`
    }

    let sourcesHtml = ''
    if (m.role === 'assistant' && m.sources && m.sources.length) {
      sourcesHtml = `
        <div class="sources">
          <button class="sources-toggle" data-id="${m.id}">
            <span>Sources</span>
            <span class="chevron ${m.sourcesOpen ? 'chevron-open' : ''}"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></span>
          </button>
          ${m.sourcesOpen ? `<div class="sources-list">${m.sources.map(s =>
            `<a href="${escapeHtml(getSourceUrl(s))}" target="_blank" rel="noopener noreferrer" class="source-item">
              <span>${escapeHtml(getSourceLabel(s))}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </a>`).join('')}</div>` : ''}
        </div>`
    }

    let followUpsHtml = ''
    if (m.role === 'assistant' && m.followUpQuestions && m.followUpQuestions.length && !m.streaming && m.id === lastAssistantId) {
      followUpsHtml = `
        <div class="follow-ups">
          ${m.followUpQuestions.map(q => {
            const question = escapeHtml(q)
            return `<button class="follow-up-btn" dir="auto" data-question="${question}">${question}</button>`
          }
          ).join('')}
        </div>`
    }

    const feedbackBtns = (!m.streaming && m.role === 'assistant') ? `<span class="msg-actions-group"><button class="msg-feedback msg-feedback-up${m.feedback === 'up' ? ' selected' : ''}" data-msg-id="${m.id}" title="Good response"><svg width="14" height="14" viewBox="0 0 24 24" fill="${m.feedback === 'up' ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg></button><button class="msg-feedback msg-feedback-down${m.feedback === 'down' ? ' selected' : ''}" data-msg-id="${m.id}" title="Bad response"><svg width="14" height="14" viewBox="0 0 24 24" fill="${m.feedback === 'down' ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg></button></span><span class="msg-actions-sep"></span>` : ''
    const copyBtn = !m.streaming ? `<div class="msg-actions">${feedbackBtns}<button class="msg-copy" data-msg-id="${m.id}" title="Copy message"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button></div>` : ''

    return `
      <article class="message ${m.role === 'user' ? 'user-message' : ''}">
        <div class="message-meta ${m.role === 'assistant' ? 'right' : ''}"><span class="role-label">${m.role === 'user' ? 'You' : 'Cloudinary AI'}</span></div>
        <div class="bubble ${m.role} ${m.error ? 'error' : ''}" dir="auto">${bubbleContent}</div>
        ${copyBtn}
        ${sourcesHtml}
        ${followUpsHtml}
      </article>`
  }).join('')

  conv.querySelectorAll('.sources-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id
      const msg = state.messages.find(m => m.id === id)
      if (msg) {
        msg.sourcesOpen = !msg.sourcesOpen
        render()
        persistMessage(msg)
      }
    })
  })
  conv.querySelectorAll('.follow-up-btn').forEach(btn => {
    btn.addEventListener('click', () => ask(btn.dataset.question))
  })

  conv.querySelectorAll('.code-copy').forEach(btn => {
    btn.addEventListener('click', () => {
      const code = btn.dataset.code || ''
      try {
        navigator.clipboard.writeText(code)
      } catch (_) {
        const ta = document.createElement('textarea')
        ta.value = code
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      const label = btn.querySelector('span')
      if (label) {
        const orig = label.textContent
        label.textContent = 'Copied!'
        btn.classList.add('copied')
        setTimeout(() => { label.textContent = orig; btn.classList.remove('copied') }, 1500)
      }
    })
  })

  conv.querySelectorAll('.msg-copy').forEach(btn => {
    btn.addEventListener('click', () => {
      const msg = state.messages.find(m => m.id === btn.dataset.msgId)
      if (!msg) {return}
      const text = msg.content || ''
      try {
        navigator.clipboard.writeText(text)
      } catch (_) {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      btn.classList.add('copied')
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>'
      setTimeout(() => {
        btn.classList.remove('copied')
        btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'
      }, 1500)
    })
  })

  conv.querySelectorAll('.msg-feedback').forEach(btn => {
    btn.addEventListener('click', () => {
      const msgId = btn.dataset.msgId
      const msg = state.messages.find(m => m.id === msgId)
      if (!msg) {return}
      const isUp = btn.classList.contains('msg-feedback-up')
      const article = btn.closest('.message')

      if (isUp) {
        const wasSelected = msg.feedback === 'up'
        msg.feedback = wasSelected ? null : 'up'
        persistMessage(msg)
        updateFeedbackButtons(btn.closest('.msg-actions'), msg)
        closeFeedbackForm(article)
        sendFeedbackToApi(msg, wasSelected ? 'none' : 'up')
        return
      }

      if (article.querySelector('.feedback-form')) {
        msg.feedback = null
        persistMessage(msg)
        updateFeedbackButtons(btn.closest('.msg-actions'), msg)
        closeFeedbackForm(article)
        return
      }
      msg.feedback = 'down'
      persistMessage(msg)
      updateFeedbackButtons(btn.closest('.msg-actions'), msg)
      showFeedbackForm(article, msg)
    })
  })

  conv.querySelectorAll('.bubble.user').forEach(bubble => {
    bubble.addEventListener('click', () => {
      if (bubble.querySelector('.edit-textarea')) {return}
      const article = bubble.closest('.message')
      const msgId = article.querySelector('.msg-copy')?.dataset.msgId
      const msg = state.messages.find(m => m.id === msgId)
      if (!msg || msg.streaming) {return}
      const actions = article.querySelector('.msg-actions')
      if (actions) {actions.style.display = 'none'}
      const originalHtml = bubble.innerHTML
      bubble.classList.add('editing')
      bubble.innerHTML = `
        <div class="edit-input-row">
          <textarea class="edit-textarea" dir="auto">${escapeHtml(msg.content)}</textarea>
          <button class="edit-send-btn" title="Save & Submit">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>`
      const textarea = bubble.querySelector('.edit-textarea')
      const sendBtn = bubble.querySelector('.edit-send-btn')
      textarea.style.height = textarea.scrollHeight + 'px'
      textarea.focus()
      textarea.setSelectionRange(textarea.value.length, textarea.value.length)

      const restoreBubble = () => {
        bubble.classList.remove('editing')
        bubble.innerHTML = originalHtml
        if (actions) {actions.style.display = ''}
      }

      textarea.addEventListener('input', () => {
        textarea.style.height = 'auto'
        textarea.style.height = textarea.scrollHeight + 'px'
        sendBtn.disabled = !textarea.value.trim()
      })
      textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          const newContent = textarea.value.trim()
          if (newContent) {editMessage(msg.id, newContent)}
        } else if (e.key === 'Escape') {
          e.preventDefault()
          restoreBubble()
        }
      })
      sendBtn.addEventListener('mousedown', (e) => e.preventDefault())
      sendBtn.addEventListener('click', () => {
        const newContent = textarea.value.trim()
        if (newContent) {editMessage(msg.id, newContent)}
      })
      textarea.addEventListener('blur', () => restoreBubble())
    })
  })

  updateComposer()
  if (state.shouldAutoScroll) {queueMicrotask(scrollToBottom)}
  queueMicrotask(() => { const input = inputEl(); if (input) {input.focus()} })
}

function updateComposer() {
  const composer = $('.composer')
  const isEmpty = state.messages.length === 0

  if (composer) {composer.style.display = isEmpty ? 'none' : ''}

  if (isEmpty) {return}

  const sendBtn = $('#send-btn')
  const stopBtn = $('#stop-btn')
  const disclaimer = $('#disclaimer')
  const input = inputEl()

  if (sendBtn && stopBtn) {
    sendBtn.style.display = state.streaming ? 'none' : 'flex'
    stopBtn.style.display = state.streaming ? 'flex' : 'none'
    sendBtn.disabled = state.loading || !(input && input.value.trim())
  }
  if (disclaimer) {disclaimer.style.display = ''}
  if (input) {input.placeholder = state.streaming ? 'Type your next message...' : 'Send a message...'}
}

function handleStreamEvent(data, askMessages, assistantId, askTabId) {
  const msg = askMessages.find(m => m.id === assistantId)
  if (!msg) {return false}

  if (data.type === 'sources') {
    msg.sources = normalizeSources(data.sources)
  } else if (data.type === 'chunk') {
    msg.content = data.fullContent ?? data.content ?? ''
    msg.streaming = true
  } else if (data.type === 'done') {
    msg.content = data.answer ?? msg.content
    msg.streaming = false
    if (state.activeTabId === askTabId) {state.streaming = false}
  } else if (data.type === 'followup') {
    msg.followUpQuestions = Array.isArray(data.questions) ? data.questions : []
  } else if (data.type === 'error') {
    msg.content = data.error ?? 'Error from server'
    msg.streaming = false
    msg.error = true
    if (state.activeTabId === askTabId) {state.streaming = false}
  } else {
    return false
  }

  return true
}

function processStreamLine(line, askMessages, assistantId, askTabId) {
  const eventLine = line.trim()
  if (!eventLine.startsWith('data:')) {return}
  const json = eventLine.slice(5).trim()
  if (!json) {return}

  try {
    const data = JSON.parse(json)
    if (handleStreamEvent(data, askMessages, assistantId, askTabId) && state.activeTabId === askTabId) {
      render()
    }
  } catch (_) {}
}

function flushStreamBuffer(buffer, askMessages, assistantId, askTabId) {
  const pending = buffer.trim()
  if (!pending) {return}
  processStreamLine(pending, askMessages, assistantId, askTabId)
}

// --- Actions ---

async function ask(text) {
  const prompt = (text || inputEl()?.value || '').trim()
  if (!prompt) {return}
  const input = inputEl()
  if (input) {
    input.value = ''
    input.style.height = 'auto'
  }

  const askTabId = state.activeTabId

  if (!state.currentConversationId) {
    const id = convId()
    const title = prompt.length > 50 ? prompt.slice(0, 50) + '...' : prompt
    const conv = { id, title, createdAt: Date.now(), updatedAt: Date.now() }
    state.currentConversationId = id
    state.conversations.unshift(conv)
    try { await dbSaveConversation(conv) } catch (e) { console.error('Failed to create conversation:', e) }
    enforceConversationLimit()
    syncRecentConversations()

    const activeTab = state.openTabs.find(t => t.id === askTabId)
    if (activeTab) {
      activeTab.conversationId = id
      activeTab.title = title
      renderTabBar()
      persistTabState()
    }
  }

  const askConversationId = state.currentConversationId
  const askMessages = state.messages

  const userMsg = { id: uid(), role: 'user', content: prompt, conversationId: askConversationId, createdAt: Date.now() }
  const assistantId = uid()
  const assistantMsg = { id: assistantId, role: 'assistant', content: '', streaming: true, sources: [], followUpQuestions: [], conversationId: askConversationId, createdAt: Date.now() + 1 }

  askMessages.push(userMsg, assistantMsg)
  tabMessagesCache.set(askTabId, askMessages)
  state.shouldAutoScroll = true
  state.loading = true
  state.streaming = true
  render()

  try {
    await dbSaveMessage({ ...userMsg, streaming: false })
  } catch (e) {
    console.error('Failed to persist user message:', e)
  }

  const askAbortController = new AbortController()
  state.abortController = askAbortController
  tabStreamState.set(askTabId, { streaming: true, loading: true, abortController: askAbortController })

  try {
    const historyForRequest = askMessages.filter(m => !m.streaming || m.id === assistantId).map(m => ({ role: m.role, content: m.content }))
    historyForRequest.pop()

    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: historyForRequest, conversationId: state.currentConversationId || '', platform: IDE_PLATFORM }),
      signal: askAbortController.signal,
    })

    if (!res.ok) {throw new Error(`HTTP ${res.status}`)}

    const reader = res.body.getReader()
    const dec = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) {break}
      buffer += dec.decode(value, { stream: true })
      const lines = buffer.split('\n\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        processStreamLine(line, askMessages, assistantId, askTabId)
      }
    }
    flushStreamBuffer(buffer, askMessages, assistantId, askTabId)
  } catch (e) {
    if (e.name !== 'AbortError') {
      const msg = askMessages.find(m => m.id === assistantId)
      if (msg) {
        msg.content = 'Request failed. Please try again.'
        msg.streaming = false
        msg.error = true
      }
    }
  } finally {
    tabStreamState.delete(askTabId)

    const msg = askMessages.find(m => m.id === assistantId)
    if (msg) {msg.streaming = false}

    if (state.activeTabId === askTabId) {
      state.abortController = null
      state.loading = false
      state.streaming = false
      render()
    }

    const conv = state.conversations.find(c => c.id === askConversationId)
    if (msg && conv) {
      try {
        await dbSaveMessage({ ...msg, conversationId: askConversationId, streaming: false })
      } catch (e) {
        console.error('Failed to persist assistant message:', e)
      }
    }

    if (conv) {
      conv.updatedAt = Date.now()
      try { await dbSaveConversation(conv) } catch (e) { console.error('Failed to update conversation:', e) }
      syncRecentConversations()
    }
  }
}

async function editMessage(msgId, newContent) {
  const idx = state.messages.findIndex(m => m.id === msgId)
  if (idx === -1) {return}
  const msg = state.messages[idx]
  msg.content = newContent

  state.messages.splice(idx + 1)
  tabMessagesCache.set(state.activeTabId, state.messages)

  try {
    await dbSaveMessage({ ...msg, streaming: false })
    await dbDeleteMessagesAfter(msg.conversationId, msg.createdAt)
  } catch (e) {
    console.error('Failed to persist edit:', e)
  }

  render()
  await askFromEdit(newContent)
}

async function askFromEdit(text) {
  const askTabId = state.activeTabId
  const askConversationId = state.currentConversationId
  const askMessages = state.messages

  const assistantId = uid()
  const assistantMsg = { id: assistantId, role: 'assistant', content: '', streaming: true, sources: [], followUpQuestions: [], conversationId: askConversationId, createdAt: Date.now() + 1 }

  askMessages.push(assistantMsg)
  tabMessagesCache.set(askTabId, askMessages)
  state.shouldAutoScroll = true
  state.loading = true
  state.streaming = true
  render()

  const askAbortController = new AbortController()
  state.abortController = askAbortController
  tabStreamState.set(askTabId, { streaming: true, loading: true, abortController: askAbortController })

  try {
    const historyForRequest = askMessages.filter(m => !m.streaming || m.id === assistantId).map(m => ({ role: m.role, content: m.content }))
    historyForRequest.pop()

    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: historyForRequest, conversationId: state.currentConversationId || '', platform: IDE_PLATFORM }),
      signal: askAbortController.signal,
    })

    if (!res.ok) {throw new Error(`HTTP ${res.status}`)}

    const reader = res.body.getReader()
    const dec = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) {break}
      buffer += dec.decode(value, { stream: true })
      const lines = buffer.split('\n\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        processStreamLine(line, askMessages, assistantId, askTabId)
      }
    }
    flushStreamBuffer(buffer, askMessages, assistantId, askTabId)
  } catch (e) {
    if (e.name !== 'AbortError') {
      const msg = askMessages.find(m => m.id === assistantId)
      if (msg) {
        msg.content = 'Request failed. Please try again.'
        msg.streaming = false
        msg.error = true
      }
    }
  } finally {
    tabStreamState.delete(askTabId)
    const msg = askMessages.find(m => m.id === assistantId)
    if (msg) {msg.streaming = false}
    if (state.activeTabId === askTabId) {
      state.abortController = null
      state.loading = false
      state.streaming = false
      render()
    }
    const conv = state.conversations.find(c => c.id === askConversationId)
    if (msg && conv) {
      try {
        await dbSaveMessage({ ...msg, conversationId: askConversationId, streaming: false })
      } catch (e) {
        console.error('Failed to persist assistant message:', e)
      }
    }
    if (conv) {
      conv.updatedAt = Date.now()
      try { await dbSaveConversation(conv) } catch (e) { console.error('Failed to update conversation:', e) }
      syncRecentConversations()
    }
  }
}

function stopGeneration() {
  const streamState = tabStreamState.get(state.activeTabId)
  const ctrl = streamState?.abortController || state.abortController
  if (ctrl) {
    ctrl.abort()
    tabStreamState.delete(state.activeTabId)
    state.abortController = null
    state.streaming = false
    state.loading = false
    const last = [...state.messages].reverse().find(m => m.role === 'assistant')
    if (last && last.streaming) {
      last.streaming = false
      last.content = last.content || 'Generation stopped.'
      persistMessage(last)
    }
    render()
    updateConversationTimestamp()
  }
}

async function askFromHomePrompt(text) {
  const prompt = (text || '').trim()
  if (!prompt) {return}

  if (state.streaming) {stopGeneration()}

  const activeTab = state.openTabs.find(t => t.id === state.activeTabId)
  const canUseActiveTab = activeTab && !activeTab.conversationId && state.messages.length === 0

  if (!canUseActiveTab) {
    if (state.activeTabId) {tabMessagesCache.set(state.activeTabId, state.messages)}
    createTab(null, 'New Chat')
    state.currentConversationId = null
    state.messages = []
    state.streaming = false
    state.loading = false
    state.abortController = null
    state.historyOpen = false
    renderTabBar()
    render()
    renderHistoryDropdown()
    persistTabState()
  }

  await ask(prompt)
}

// --- Migration from vscode.getState ---

async function migrateFromVSCodeState() {
  const vsState = vscode.getState()
  if (!vsState || !vsState.messages || vsState.messages.length === 0) {return null}

  const existing = await dbGetAllConversations()
  if (existing.length > 0) {
    vscode.setState({})
    return null
  }

  const id = convId()
  const firstUser = vsState.messages.find(m => m.role === 'user')
  const title = firstUser
    ? (firstUser.content.length > 50 ? firstUser.content.slice(0, 50) + '...' : firstUser.content)
    : 'Previous chat'
  const now = Date.now()

  await dbSaveConversation({ id, title, createdAt: now, updatedAt: now })

  for (const m of vsState.messages) {
    await dbSaveMessage({
      ...m,
      conversationId: id,
      streaming: false,
      createdAt: m.createdAt || now,
    })
  }

  vscode.setState({})
  return id
}

async function loadInitialConversation(conversationId) {
  const id = typeof conversationId === 'string' ? conversationId.trim() : ''
  if (!id) {return false}

  const conv = state.conversations.find(c => c.id === id)
  if (!conv) {return false}

  createTab(conv.id, conv.title)
  state.currentConversationId = conv.id
  try {
    const msgs = await dbGetMessages(conv.id)
    state.messages = msgs.map(m => ({ ...m, streaming: false }))
  } catch (_) {
    state.messages = []
  }
  persistTabState()
  return true
}

async function openConversationFromHost(conversationId) {
  const id = typeof conversationId === 'string' ? conversationId.trim() : ''
  if (!id) {return}
  await loadConversations()
  await loadConversation(id)
  syncRecentConversations()
}

// --- Init ---

async function init() {
  const initialPrompt = INITIAL_PROMPT
  const initialConversationId = INITIAL_CONVERSATION_ID
  const migratedId = await migrateFromVSCodeState()
  await loadConversations()

  let restoredTabState = null
  if (!initialPrompt && !initialConversationId) {
    try { restoredTabState = await dbLoadTabState() } catch (_) {}
  }

  if (initialPrompt) {
    createTab(null, 'New Chat')
    persistTabState()
  } else if (initialConversationId) {
    const loaded = await loadInitialConversation(initialConversationId)
    if (!loaded) {
      createTab(null, 'New Chat')
      persistTabState()
    }
  } else if (restoredTabState && restoredTabState.openTabs && restoredTabState.openTabs.length > 0) {
    state.openTabs = restoredTabState.openTabs
    state.activeTabId = restoredTabState.activeTabId

    const validTabIds = state.openTabs.map(t => t.id)
    if (!validTabIds.includes(state.activeTabId)) {state.activeTabId = state.openTabs[0].id}

    const activeTab = state.openTabs.find(t => t.id === state.activeTabId)
    if (activeTab && activeTab.conversationId) {
      try {
        const msgs = await dbGetMessages(activeTab.conversationId)
        state.messages = msgs.map(m => ({ ...m, streaming: false }))
        state.currentConversationId = activeTab.conversationId
      } catch (e) {
        state.messages = []
        state.currentConversationId = null
      }
    }
  } else if (migratedId) {
    const conv = state.conversations.find(c => c.id === migratedId)
    createTab(migratedId, conv ? conv.title : 'Previous chat')
    try {
      const msgs = await dbGetMessages(migratedId)
      state.messages = msgs.map(m => ({ ...m, streaming: false }))
      state.currentConversationId = migratedId
    } catch (_) {}
    persistTabState()
  } else if (state.conversations.length > 0) {
    const latest = state.conversations[0]
    createTab(latest.id, latest.title)
    try {
      const msgs = await dbGetMessages(latest.id)
      state.messages = msgs.map(m => ({ ...m, streaming: false }))
      state.currentConversationId = latest.id
    } catch (_) {}
    persistTabState()
  } else {
    createTab(null, 'New Chat')
    persistTabState()
  }

  renderTabBar()
  render()
  syncRecentConversations()

  const conv = conversationEl()
  if (conv) {
    conv.addEventListener('scroll', () => {
      if (!state.streaming) {return}
      if (state.isAutoScrolling) {return}
      const isNearBottom = conv.scrollHeight - conv.scrollTop - conv.clientHeight < 120
      state.shouldAutoScroll = isNearBottom
    }, { passive: true })
  }

  const input = inputEl()
  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        if (state.streaming) {stopGeneration()}
        else {ask()}
      }
    })
    input.addEventListener('input', () => {
      input.style.height = 'auto'
      input.style.height = Math.min(input.scrollHeight, 150) + 'px'
      updateComposer()
    })
  }

  $('#send-btn')?.addEventListener('click', () => ask())
  $('#stop-btn')?.addEventListener('click', stopGeneration)
  initActionToolbar({
    onAction: (action) => {
      if (action === 'showHomescreen') {
        syncRecentConversations()
      }
      vscode.postMessage({ command: 'runToolbar', action })
    },
  })
  $('#new-chat-btn')?.addEventListener('click', newChat)
  $('#history-btn')?.addEventListener('click', toggleHistoryDropdown)

  window.addEventListener('message', (event) => {
    const msg = event.data
    if (msg?.command === 'askPrompt') {
      askFromHomePrompt(msg.prompt)
    } else if (msg?.command === 'openConversation') {
      openConversationFromHost(msg.conversationId)
    } else if (msg?.command === 'syncRecentConversations') {
      syncRecentConversationsFromStorage()
    }
  })

  document.addEventListener('click', (e) => {
    if (state.historyOpen) {
      const dropdown = $('#history-dropdown')
      const historyBtn = $('#history-btn')
      if (dropdown && !dropdown.contains(e.target) && historyBtn && !historyBtn.contains(e.target)) {
        state.historyOpen = false
        renderHistoryDropdown()
      }
    }
  })

  if (initialPrompt) {
    askFromHomePrompt(initialPrompt)
  }
}

document.addEventListener('DOMContentLoaded', init)
