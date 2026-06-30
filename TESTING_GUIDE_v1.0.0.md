# Testing guide: Cloudinary VS Code extension v1.0.0

Hey team, this build is for the v1.0.0 GA release of the VS Code extension. Below is what's new and what to poke at.

> 💬 **Feedback:** Please share your feedback about the extension in the shared Google Doc. Bugs welcome, copy nits welcome, "this UX is confusing" welcome.
> For comments about the AI responses, please use the thumbs up/down feature on each message to leave feedback tied to conversations.

---

## 1. Install

1. Save `cloudinary-1.0.0.vsix` somewhere on your Mac.
2. In VS Code:
   - `Cmd+Shift+P` → **Extensions: Install from VSIX…** → pick the file
   - **or** open your extensions pane, then drag and drop the VSIX file into it
3. Reload: `Cmd+Shift+P` → **Developer: Reload Window**.
4. Open the **Cloudinary icon** in the Activity Bar

### If you've never set up Cloudinary credentials before

You should see a "Add your API credentials to connect" banner on the homescreen. Click **Configure** to open the global config file. Paste your cloud name + API key + API secret. Save the file. The banner should disappear and your cloud name should appear at the top.

If you already have credentials configured, skip ahead.

---

## 2. Smoke test: does anything obviously break?

- [ ] The Cloudinary icon shows in the Activity Bar.
- [ ] Clicking it opens the homescreen with no errors.
- [ ] Your cloud name appears at the top of the homescreen.
- [ ] The "Browse Library", "Upload", and "Configure AI Tools" tiles all render.
- [ ] The "Ask Cloudinary AI" section (heading + textarea + suggested-question chips) renders below the tiles.
- [ ] No red error notifications pop up.

If any of these fail, stop and report. The rest of the guide assumes the basics work.

---

## 3. Homescreen

The homescreen is the new landing view. Test:

- [ ] **Search box**: type a query (e.g. `transformation`). Hitting Enter should open the library view with that search applied.
- [ ] **Status pill (top right)**: the text reads "Connected" when your credentials are valid, "Setup needed" otherwise. There's a small dot beside the text that changes appearance when not configured.
- [ ] **Folder mode chip**: shows "Dynamic folders" or "Fixed folders" beside your cloud name (only when credentials are configured).
- [ ] **Browse Library tile**: clicking opens the library view.
- [ ] **Upload tile**: clicking opens the upload widget panel.
- [ ] **Switch Environment tile**: only appears if you have 2+ environments configured. Clicking it should let you swap.
- [ ] **Configure AI Tools tile**: clicking expands an inline panel below the tile (see Section 6). Clicking again collapses it.
- [ ] **Ask Cloudinary AI section**: heading "Ask Cloudinary AI", subtitle, a "Send a message…" textarea, a send button, and 4 suggested-question chips ("What's new in Cloudinary?", "How do I upload images?", "Explain image transformations", "What SDKs does Cloudinary support?"). Pressing Enter or clicking send takes you into Docs AI with that prompt pre-filled.
- [ ] **View recent conversations**: a clock-icon toggle appears below the Ask Cloudinary AI section once you have one or more past chats. Clicking it expands a list of recent conversations.
- [ ] **Welcome Guide** link in the footer.

**Things to look for:**
- Does the homescreen render quickly? It's supposed to paint a static shell first and load data after.
- Any visual jank when you resize the sidebar narrow vs. wide?
- Anything that feels off in the copy?

---

## 4. Library view

Open the library by clicking the "Browse Library" tile on the homescreen. This swaps the Cloudinary sidebar from the homescreen over to the library view. To get back, click the Home button in the toolbar at the top of the library view.

- [ ] **Folder expand**: clicking a folder reveals its contents. Big folders should stream in (a loading row appears at the bottom).
- [ ] **Search**: the search input at the top filters across the library. Pressing Escape clears it.
- [ ] **Type filter**: dropdown with All / Images / Videos / Raw.
- [ ] **Sort**: dropdown with Newest / Oldest.
- [ ] **Click an asset**: opens a preview panel with optimized image/video, public ID, copy buttons, and metadata.
- [ ] **Right-click an asset**: context menu with options to copy the public ID, the URL, and the optimized URL.
- [ ] **Switch environment while a preview is open**: the preview panel closes cleanly (rather than trying to update in place with stale data).

**Things to look for:**
- Does scrolling stay smooth with hundreds of items?
- Does the loading indicator behave correctly at the bottom?
- Are folder icons and asset thumbnails rendering properly?

---

## 5. Docs AI chat: biggest new feature

This is the in-editor doc chatbot. The Cloudinary sidebar shows one view at a time (Homescreen, Library, or Docs AI), so opening Docs AI swaps the sidebar over to that view. Ways to get there:

- Type in the "Ask Cloudinary AI" textarea on the homescreen and submit (sends your prompt and opens Docs AI).
- Click any of the suggested-question chips on the homescreen.
- Click a recent conversation entry on the homescreen (after you have any).
- Run "Open Docs AI" from the Command Palette.

To return to the homescreen, click the Home button in the toolbar at the top of the Docs AI view.

The Docs AI view contains: a tab strip at the top (one tab per conversation), a "+" button to start a new chat, a clock-icon button for chat history, a conversation area, and a composer at the bottom with a textarea (placeholder "Send a message…"), a send button, and a stop button.

- [ ] **Ask a basic question** (e.g. "How do I upload an image with Node.js?"). The response should stream in word by word.
- [ ] **Inline citations**: numbered citation markers appear in the answer text and link to the corresponding sources.
- [ ] **Sources section**: a collapsible "Sources" block sits below the answer with a chevron toggle. Clicking a source link opens the docs page in your browser.
- [ ] **Follow-up questions**: 2-3 suggested follow-up prompts appear below an answer.
- [ ] **Disclaimer line** at the bottom: "AI can make mistakes. Verify important info from Cloudinary docs."

### Chat history

- [ ] **New chat (+ button)**: starts a fresh conversation in a new tab.
- [ ] **Tab strip**: each conversation gets its own tab at the top. You can switch between them.
- [ ] **History button (clock icon)**: opens a dropdown of past conversations.
- [ ] **Clear all conversations**: from the history dropdown, there should be a way to delete all. Confirm there's a "Delete all conversations?" confirmation before it deletes.

### Things to test for content quality

- [ ] **Recent docs are in the index**: try asking about something that landed in the May 2026 MediaFlows release notes (e.g. "What's the Workflow Agent in MediaFlows?"). It should answer correctly.
- [ ] **Stop generation**: start a long answer, hit the stop button mid-stream. The stream should stop cleanly.
- [ ] **Non-English question**: try Hebrew, Spanish, or another language. The bot should answer in that language.
- [ ] **Code in answers**: questions about code should get back fenced code blocks that look right.
- [ ] **Thumbs up/down on each AI message**: confirm both states register (the bot acknowledges the feedback was saved).

**Known limitation:** docs marked `noindex: true` are intentionally excluded from the chatbot index (e.g. internal-only pages or Beta features still in alpha). So if you ask about a hidden/beta-only feature, it might not have it.

---

## 6. Configure AI Tools

This installs Cloudinary skills + MCP servers into your AI coding tools (Cursor, Claude Code, VS Code Copilot, Windsurf, and many more).

- [ ] Click the **Configure AI Tools** tile on the homescreen. An inline panel expands below it.
- [ ] **Platform dropdown**: pick from the list of supported platforms. The dropdown should default to one that matches your current environment when possible (e.g. "VS Code (Copilot)" when running inside VS Code).
- [ ] **Scope toggle**: two buttons, "Project" and "Global". Toggle between them.
- [ ] **Skills + MCP servers list**: shows checkboxes for each available skill and MCP server. Items already installed for the chosen platform + scope are shown as disabled / pre-checked.
- [ ] **Apply button**: enabled only when you have at least one selection to install. Click it. The button label changes to "Applying…", then each item shows a ✓ (success) or ✕ (failure) tick.
- [ ] **Reopen the panel**: skills you installed should now show as already installed (not re-offering them at the same scope).
- [ ] **Switch platform** mid-flow: changing the platform dropdown should reload the list with whatever is correct for that new platform.

**Things to look for:**
- Does the platform list cover what you actually use?
- Did it auto-pick the right default platform for you?
- Are the install instructions / cover notes clear?
- Anything that errors silently or fails without a clear message?

---

## 7. Upload widget

- [ ] Click "Upload" on the homescreen. The upload widget panel opens.
- [ ] Drag a file onto it (or pick one via the file picker). Progress should show in real time.
- [ ] Upload completes, the asset appears in the recently-uploaded section.
- [ ] **Chunked upload**: try a file larger than 20 MB (the threshold for chunked uploads). It should complete reliably without timing out.
- [ ] **Switch environment with the widget open**: the widget should close cleanly rather than try to update in place.
- [ ] The panel title should reflect the active cloud name.

---

## 8. Environment switching

Only relevant if you have multiple Cloudinary environments configured.

- [ ] The VS Code **status bar at the bottom** shows a cloud icon followed by the active cloud name.
- [ ] Click the status bar item (or use the Switch Environment tile on the homescreen) to swap environments.
- [ ] After switching:
  - Library view refreshes with the new environment's assets.
  - Upload presets refetch.
  - Any open preview/upload panels close cleanly.
  - The folder-mode chip updates if the new environment uses a different mode.

---

## Known limitations / things NOT in this build

- The "**Docs AI agent actions**" feature (the experimental version where the bot can take actions on your media library directly) is **not** in this build. That's still on a feature branch.
- No marketplace publishing yet. This is a side-load VSIX only.
- KB articles flagged `noindex: true` in our docs source are intentionally excluded from the Docs AI index.

---

## What we'd love to know

1. **First-impression UX**: what feels off when you first open the extension?
2. **Docs AI answer quality**: does it actually help you find what you'd normally search for in our docs?
3. **Performance**: any slow spots? Sidebar lag, library scroll jank, Docs AI streaming delays?
4. **Copy**: anything in button labels, tooltips, or empty states that doesn't quite read right?
5. **Platform detection** in Configure AI Tools: did it correctly identify what you have installed?
6. **Anything that crashed or showed an error**: please screenshot + the steps to reproduce.

Drop notes in the shared Google Doc, or reply on the email thread.

Thanks for testing! 🙏
