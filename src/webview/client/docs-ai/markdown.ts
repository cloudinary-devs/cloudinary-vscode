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
  a: new Set(['class', 'href', 'rel', 'target', 'title']),
  button: new Set(['aria-label', 'class', 'data-code', 'title', 'type']),
  code: new Set(['class']),
  div: new Set(['class']),
  pre: new Set(['class']),
  span: new Set(['class']),
  th: new Set(['align']),
  td: new Set(['align']),
}
const allowedClassNames = new Set([
  'code-block', 'code-copy', 'code-header', 'code-lang', 'doc-citation', 'hljs',
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

function sourcePath(source) {
  if (typeof source === 'string') {return source}
  return source?.path || source?.source || source?.id || source?.slug || source?.url || ''
}

function sourceSlug(source) {
  const path = sourcePath(source)
  try {
    const url = new URL(path)
    const match = url.pathname.match(/\/documentation\/([^/#?]+)/)
    if (match) {return match[1]}
  } catch (_) {}

  return path
    .replace(/^https?:\/\/(?:www\.)?cloudinary\.com\/documentation\//, '')
    .replace(/^content\/documentation\//, '')
    .replace(/\.html\.md$/, '')
    .replace(/\.md$/, '')
    .replace(/^\/+|\/+$/g, '')
}

function sourceUrl(source) {
  if (source && typeof source === 'object' && source.url) {return source.url}
  const slug = sourceSlug(source)
  return `https://cloudinary.com/documentation/${slug}`
}

function sourceLabel(source) {
  if (source && typeof source === 'object' && source.title) {return source.title}
  const label = sourceSlug(source).replace(/_/g, ' ')
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function sourceAliases(source) {
  const path = sourcePath(source)
  const slug = sourceSlug(source)
  const basename = slug.split('/').pop() || slug
  return [
    path,
    slug,
    basename,
    `${slug}.md`,
    `${basename}.md`,
    `${slug}.html.md`,
    `${basename}.html.md`,
    `content/documentation/${slug}.html.md`,
    `content/documentation/${basename}.html.md`,
  ].filter(Boolean)
}

function normalizeAlias(value) {
  return String(value || '')
    .trim()
    .replace(/^`|`$/g, '')
    .replace(/^["']|["']$/g, '')
    .replace(/^https?:\/\/(?:www\.)?cloudinary\.com\/documentation\//, '')
    .replace(/^content\/documentation\//, '')
    .replace(/\.html\.md$/, '')
    .replace(/\.md$/, '')
    .replace(/^\/+|\/+$/g, '')
    .toLowerCase()
}

function buildCitationMap(sources) {
  const map = new Map()
  ;(sources || []).forEach((source, index) => {
    sourceAliases(source).forEach(alias => {
      map.set(normalizeAlias(alias), { index: index + 1, source })
    })
  })
  return map
}

function citationHtml(citation) {
  const href = escapeAttribute(sourceUrl(citation.source))
  const title = escapeAttribute(sourceLabel(citation.source))
  return `<a class="doc-citation" href="${href}" title="${title}" target="_blank" rel="noopener noreferrer">[${citation.index}]</a>`
}

function replaceInlineCitations(content, sources) {
  const citationMap = buildCitationMap(sources)
  if (!citationMap.size) {return content}

  let processed = content.replace(/\(([^()\n]{3,240})\)/g, (match, inner) => {
    const parts = inner.split(',').map(part => part.trim()).filter(Boolean)
    if (!parts.length) {return match}

    const citations = parts.map(part => citationMap.get(normalizeAlias(part)))
    if (citations.some(citation => !citation)) {return match}

    const unique = []
    const seen = new Set()
    citations.forEach(citation => {
      if (seen.has(citation.index)) {return}
      seen.add(citation.index)
      unique.push(citation)
    })

    return unique.map(citationHtml).join(' ')
  })

  processed = processed.replace(
    /content\/documentation\/([a-zA-Z0-9_/-]+)\.html\.md|([a-zA-Z0-9_/-]+)\.md/g,
    (match) => citationMap.has(normalizeAlias(match)) ? citationHtml(citationMap.get(normalizeAlias(match))) : match
  )

  return processed
}

export function renderMarkdown(content, sources = []) {
  const processed = replaceInlineCitations(content, sources)
  try { return sanitizeMarkdownHtml(marked(processed, { renderer })) } catch (_) { return escapeHtml(content) }
}
