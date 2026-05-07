// @ts-nocheck

const DEFAULT_API_BASE = 'https://cld-docs-ai-delta.vercel.app'

function normalizeApiBase(value) {
  const rawValue = typeof value === 'string' ? value.trim() : ''
  if (!rawValue) {return DEFAULT_API_BASE}

  try {
    const url = new URL(rawValue)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {return DEFAULT_API_BASE}
    url.hash = ''
    url.search = ''
    return url.href.replace(/\/+$/, '')
  } catch (_) {
    return DEFAULT_API_BASE
  }
}

export const API_BASE = normalizeApiBase(
  typeof window !== 'undefined' ? window.__DOCS_AI_API_BASE__ : DEFAULT_API_BASE
)
export const API_URL = `${API_BASE}/api/rag/chat-ai`
export const vscode = acquireVsCodeApi()

const rawIdeName = (typeof window !== 'undefined' && window.__IDE_NAME__) || 'vscode'
export const IDE_PLATFORM = rawIdeName.toLowerCase().replace(/\s+/g, '-')
export const INITIAL_PROMPT =
  typeof window !== 'undefined' && typeof window.__INITIAL_PROMPT__ === 'string'
    ? window.__INITIAL_PROMPT__.trim()
    : ''

export const state = {
  messages: [],
  conversations: [],
  currentConversationId: null,
  streaming: false,
  loading: false,
  abortController: null,
  shouldAutoScroll: true,
  isAutoScrolling: false,
  historyOpen: false,
  moreMenuOpen: false,
  openTabs: [],
  activeTabId: null,
}

export const tabMessagesCache = new Map()
export const tabStreamState = new Map()

export const starterQuestions = [
  'How do I upload images?',
  'Explain image transformations',
  'How do I optimize videos?',
  'What SDKs does Cloudinary support?',
  'How do I resize images?',
  'What is the Media Library?',
  'How do I crop images?',
  'What is DAM?',
]

export function pickStarters(n) {
  const s = [...starterQuestions].sort(() => Math.random() - 0.5)
  return s.slice(0, n)
}

export function uid() {
  return 'msg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8)
}

export function convId() {
  return 'conv-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8)
}

export function tabId() {
  return 'tab-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8)
}

export const $ = (sel) => document.querySelector(sel)
export const conversationEl = () => $('#conversation')
export const inputEl = () => $('#chat-input')

let autoScrollToken = 0

export function scrollToBottom() {
  if (!state.shouldAutoScroll) {return}
  const conv = conversationEl()
  if (!conv) {return}

  const token = ++autoScrollToken
  state.isAutoScrolling = true

  const pinToBottom = () => {
    conv.scrollTop = conv.scrollHeight
  }

  pinToBottom()
  requestAnimationFrame(pinToBottom)

  setTimeout(() => {
    if (token === autoScrollToken) {state.isAutoScrolling = false}
  }, 120)
}

export function normalizeSources(payload) {
  if (!Array.isArray(payload)) {return []}
  return payload.map(item => {
    if (typeof item === 'string') {return item}
    if (item && typeof item === 'object') {return item.path || item.source || item.id || null}
    return null
  }).filter(Boolean)
}

export function getSourceUrl(path) {
  let d = path.replace(/^content\/documentation\//, '').replace(/\.html\.md$/, '').replace(/\.md$/, '')
  return `https://cloudinary.com/documentation/${d}`
}

export function getSourceLabel(path) {
  const label = path.replace(/^content\/documentation\//, '').replace(/\.html\.md$/, '').replace(/\.md$/, '').replace(/_/g, ' ')
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function escapeHtml(str) {
  const d = document.createElement('div')
  d.textContent = str
  return d.innerHTML
}

export function timeAgo(ts) {
  const seconds = Math.floor((Date.now() - ts) / 1000)
  if (seconds < 60) {return 'just now'}
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) {return `${minutes}m`}
  const hours = Math.floor(minutes / 60)
  if (hours < 24) {return `${hours}h`}
  const days = Math.floor(hours / 24)
  if (days < 30) {return `${days}d`}
  return new Date(ts).toLocaleDateString()
}

// Callbacks set by webview.js to break circular deps
export const callbacks = {
  render: () => {},
  renderHistoryDropdown: () => {},
}
