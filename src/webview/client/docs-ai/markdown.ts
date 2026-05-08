// @ts-nocheck

import { marked } from 'marked'
import hljs from 'highlight.js/lib/common'

marked.setOptions({ breaks: true, gfm: true })
const renderer = new marked.Renderer()

const allowedTags = new Set([
  'a', 'blockquote', 'br', 'button', 'code', 'del', 'div', 'em', 'h1', 'h2',
  'h3', 'h4', 'h5', 'h6', 'hr', 'li', 'ol', 'p', 'pre', 'span', 'strong',
  'table', 'tbody', 'td', 'th', 'thead', 'tr', 'ul',
])
const removeWithChildren = new Set([
  'audio', 'canvas', 'embed', 'form', 'iframe', 'img', 'input', 'math', 'object',
  'script', 'select', 'style', 'svg', 'textarea', 'video',
])
const allowedAttrs = {
  a: new Set(['href', 'rel', 'target', 'title']),
  button: new Set(['aria-label', 'class', 'data-code', 'title', 'type']),
  code: new Set(['class']),
  div: new Set(['class']),
  pre: new Set(['class']),
  span: new Set(['class']),
  th: new Set(['align']),
  td: new Set(['align']),
}
const allowedClassNames = new Set([
  'code-block', 'code-copy', 'code-header', 'code-lang', 'hljs',
])

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, '&#96;')
}

function safeLanguageToken(value) {
  const token = String(value || '').trim()
  return /^[a-zA-Z0-9_-]+$/.test(token) ? token : ''
}

function sanitizeClassList(value) {
  return String(value || '')
    .split(/\s+/)
    .filter(Boolean)
    .filter((name) => allowedClassNames.has(name) || name.startsWith('hljs-') || name.startsWith('language-'))
    .join(' ')
}

function isSafeUrl(value) {
  try {
    const url = new URL(value, 'https://cloudinary.com')
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch (_) {
    return false
  }
}

function unwrapElement(element) {
  const parent = element.parentNode
  if (!parent) {return}
  while (element.firstChild) {
    parent.insertBefore(element.firstChild, element)
  }
  element.remove()
}

function sanitizeElement(element) {
  const tag = element.tagName.toLowerCase()

  if (removeWithChildren.has(tag)) {
    element.remove()
    return
  }

  if (!allowedTags.has(tag)) {
    unwrapElement(element)
    return
  }

  Array.from(element.attributes).forEach((attr) => {
    const name = attr.name.toLowerCase()
    const allowedForTag = allowedAttrs[tag]

    if (!allowedForTag?.has(name)) {
      element.removeAttribute(attr.name)
      return
    }

    if (name === 'class') {
      const safeClass = sanitizeClassList(attr.value)
      if (safeClass) {
        element.setAttribute('class', safeClass)
      } else {
        element.removeAttribute('class')
      }
      return
    }

    if (tag === 'a' && name === 'href' && !isSafeUrl(attr.value)) {
      element.removeAttribute('href')
    }
  })

  if (tag === 'a' && element.hasAttribute('href')) {
    element.setAttribute('target', '_blank')
    element.setAttribute('rel', 'noopener noreferrer')
  }

  if (tag === 'button') {
    if (!element.classList.contains('code-copy')) {
      unwrapElement(element)
      return
    }
    element.setAttribute('type', 'button')
    element.setAttribute('aria-label', 'Copy code')
  }
}

function sanitizeMarkdownHtml(html) {
  const template = document.createElement('template')
  template.innerHTML = html

  const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_ELEMENT)
  const elements = []
  let node = walker.nextNode()
  while (node) {
    elements.push(node)
    node = walker.nextNode()
  }

  elements.forEach((element) => sanitizeElement(element))
  return template.innerHTML
}

renderer.link = function ({ href, title, text }) {
  const t = title ? ` title="${escapeAttribute(title)}"` : ''
  return `<a href="${escapeAttribute(href || '')}"${t} target="_blank" rel="noopener noreferrer">${text}</a>`
}
renderer.code = function ({ text, lang }) {
  let highlighted
  let displayLang = lang || ''
  const safeLang = safeLanguageToken(lang)
  if (lang && hljs.getLanguage(lang)) {
    try {
      highlighted = hljs.highlight(text, { language: lang }).value
    } catch (_) {
      const auto = hljs.highlightAuto(text)
      highlighted = auto.value
      if (!displayLang && auto.language) {displayLang = auto.language}
    }
  } else {
    const auto = hljs.highlightAuto(text)
    highlighted = auto.value
    if (!displayLang && auto.language) {displayLang = auto.language}
  }

  const langLabel = displayLang ? `<span class="code-lang">${escapeHtml(displayLang)}</span>` : ''
  const escapedText = escapeAttribute(text)

  return `<div class="code-block">
    <div class="code-header">
      ${langLabel}
      <button class="code-copy" type="button" data-code="${escapedText}" title="Copy code" aria-label="Copy code">
        <span>Copy</span>
      </button>
    </div>
    <pre><code class="hljs${safeLang ? ` language-${safeLang}` : ''}">${highlighted}</code></pre>
  </div>`
}

export function renderMarkdown(content) {
  const processed = content.replace(
    /content\/documentation\/([a-zA-Z0-9_\-]+)\.html\.md/g,
    (_, f) => `[${f.replace(/_/g, ' ')}](https://cloudinary.com/documentation/${f})`
  )
  try { return sanitizeMarkdownHtml(marked(processed, { renderer })) } catch (_) { return escapeHtml(content) }
}
