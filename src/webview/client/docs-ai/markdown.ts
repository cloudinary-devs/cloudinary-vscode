// @ts-nocheck

import { marked } from 'marked'
import hljs from 'highlight.js/lib/common'

marked.setOptions({ breaks: true, gfm: true })
const renderer = new marked.Renderer()
renderer.link = function ({ href, title, text }) {
  const t = title ? ` title="${title}"` : ''
  return `<a href="${href}"${t} target="_blank" rel="noopener noreferrer">${text}</a>`
}
renderer.code = function ({ text, lang }) {
  let highlighted
  let displayLang = lang || ''
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

  const langLabel = displayLang ? `<span class="code-lang">${displayLang}</span>` : ''
  const escapedText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

  return `<div class="code-block">
    <div class="code-header">
      ${langLabel}
      <button class="code-copy" data-code="${escapedText}" title="Copy code">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        <span>Copy</span>
      </button>
    </div>
    <pre><code class="hljs${lang ? ` language-${lang}` : ''}">${highlighted}</code></pre>
  </div>`
}

export function renderMarkdown(content) {
  const processed = content.replace(
    /content\/documentation\/([a-zA-Z0-9_\-]+)\.html\.md/g,
    (_, f) => `[${f.replace(/_/g, ' ')}](https://cloudinary.com/documentation/${f})`
  )
  try { return marked(processed, { renderer }) } catch (_) { return content }
}
