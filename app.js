(function () {
    const PASSWORD_HASH = "3477699d6895a202360941241b8890bd7305f2073045b1c8c76946be9a60454e";
    const passwordForm = document.getElementById("password-form");
    const passwordInput = document.getElementById("password-input");
    const passwordError = document.getElementById("password-error");
    const passwordField = document.getElementById("password-field");
    const usernameInput = document.getElementById("username-input");
    const userBtn = document.getElementById("user-btn");

    // The username labels my side when comparing with someone else's coding.
    const USERNAME_KEY = "transcript-coder:username";
    let username = localStorage.getItem(USERNAME_KEY) || "";
    usernameInput.value = username;

    function setUsername(name) {
        username = name;
        localStorage.setItem(USERNAME_KEY, name);
        userBtn.textContent = "Coder: " + name;
    }
    if (username) setUsername(username);

    userBtn.addEventListener("click", () => {
        const name = (prompt("Your username:", username) || "").trim();
        if (name) setUsername(name);
    });

    // Skip the password when served locally (e.g. via server.py); the gate
    // then only asks for a username, and only if none is saved yet.
    const isLocalhost = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(location.hostname);
    if (isLocalhost) {
        passwordField.style.display = "none";
        passwordInput.required = false;
    }
    document.body.classList.toggle("authenticated", isLocalhost && !!username);
    passwordForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const name = usernameInput.value.trim();
        if (!name) {
            passwordError.textContent = "Enter a username.";
            usernameInput.focus();
            return;
        }
        if (isLocalhost) {
            setUsername(name);
            document.body.classList.add("authenticated");
            return;
        }
        const bytes = new TextEncoder().encode(passwordInput.value);
        const digest = await crypto.subtle.digest("SHA-256", bytes);
        const enteredHash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
        if (enteredHash === PASSWORD_HASH) {
            setUsername(name);
            document.body.classList.add("authenticated");
            passwordError.textContent = "";
            passwordInput.value = "";
        } else {
            passwordError.textContent = "Incorrect password.";
            passwordInput.select();
        }
    });

    // ---- Transcripts ------------------------------------------------------
    // Filled with transcripts the user loads via "Load transcript…" (and those
    // remembered from earlier sessions). Each entry: { label, file, type, html }.
    const TRANSCRIPTS = [];

    const CATEGORY_COLORS = {
        "Data Collection": "#a8d5ff",
        "Data Analysis and Use": "#ffd699",
        "HCI Design Opportunities": "#c9f2c9",
    };

    const CODES_KEY = "transcript-coder:codes";
    const UPLOADED_TRANSCRIPTS_KEY = "transcript-coder:uploaded-transcripts";
    const RESEARCH_QUESTIONS_KEY = "transcript-coder:research-questions";
    const highlightsKey = (file) => "transcript-coder:highlights:" + file;

    const transcriptSelect = document.getElementById("transcript-select");
    const loadTranscriptBtn = document.getElementById("load-transcript-btn");
    const loadTranscriptInput = document.getElementById("load-transcript-input");
    const transcriptPane = document.getElementById("transcript-pane");
    const statusEl = document.getElementById("status");
    const codeForm = document.getElementById("code-form");
    const newCodeName = document.getElementById("new-code-name");
    const newCodeNameClearBtn = document.getElementById("new-code-name-clear");
    // Color preselected in the new-code modal; remembers the last one used.
    let newCodeColor = "#ffe066";
    const codeSearchInput = document.getElementById("code-search");
    const codeSearchClearBtn = document.getElementById("code-search-clear");
    const codeListEl = document.getElementById("code-list");
    const activeCodeBanner = document.getElementById("active-code-banner");
    const codingsListEl = document.getElementById("codings-list");
    const codeFreqChartEl = document.getElementById("code-freq-chart");
    const clearBtn = document.getElementById("clear-transcript-btn");
    const exportBtn = document.getElementById("export-btn");
    const exportTranscriptBtn = document.getElementById("export-transcript-btn");
    const saveCodebookBtn = document.getElementById("save-codebook-btn");
    const applyFromFileBtn = document.getElementById("apply-from-file-btn");
    const applyFromFileInput = document.getElementById("apply-from-file-input");
    const modalBackdrop = document.getElementById("modal-backdrop");
    const modalTitle = document.getElementById("modal-title");
    const modalDefinition = document.getElementById("modal-definition");
    const modalCategory = document.getElementById("modal-category");
    const modalNewCategoryWrap = document.getElementById("modal-new-category-wrap");
    const modalNewCategory = document.getElementById("modal-new-category");
    const modalEditFields = document.getElementById("modal-edit-fields");
    const modalName = document.getElementById("modal-name");
    const modalColor = document.getElementById("modal-color");
    const modalCancelBtn = document.getElementById("modal-cancel-btn");
    const modalConfirmBtn = document.getElementById("modal-confirm-btn");
    const quotesModalBackdrop = document.getElementById("quotes-modal-backdrop");
    const quotesModalTitle = document.getElementById("quotes-modal-title");
    const quotesModalList = document.getElementById("quotes-modal-list");
    const quotesModalCloseBtn = document.getElementById("quotes-modal-close-btn");
    const quoteCodesModalBackdrop = document.getElementById("quote-codes-modal-backdrop");
    const quoteCodesModalTitle = document.getElementById("quote-codes-modal-title");
    const quoteCodesModalList = document.getElementById("quote-codes-modal-list");
    const quoteCodesModalCloseBtn = document.getElementById("quote-codes-modal-close-btn");
    const codeContextMenu = document.getElementById("code-context-menu");
    const contextEditCodeBtn = document.getElementById("context-edit-code-btn");
    const contextApplyCodeBtn = document.getElementById("context-apply-code-btn");
    const aiApplyModalBackdrop = document.getElementById("ai-apply-modal-backdrop");
    const aiApplyModalTitle = document.getElementById("ai-apply-modal-title");
    const aiApplyModalBody = document.getElementById("ai-apply-modal-body");
    const aiApplyCancelBtn = document.getElementById("ai-apply-cancel-btn");
    const aiApplyConfirmBtn = document.getElementById("ai-apply-confirm-btn");
    const codebookPickerBackdrop = document.getElementById("codebook-picker-backdrop");
    const codebookPickerTitle = document.getElementById("codebook-picker-title");
    const codebookPickerList = document.getElementById("codebook-picker-list");
    const codebookPickerFileInput = document.getElementById("codebook-picker-file-input");
    const rqListEl = document.getElementById("rq-list");
    const rqAddBtn = document.getElementById("rq-add-btn");
    const rqLoadBtn = document.getElementById("rq-load-btn");
    const rqLoadInput = document.getElementById("rq-load-input");
    let researchQuestions = loadResearchQuestions();
    let contextMenuCode = null;
    let aiSuggestions = [];
    let pendingCode = null;
    let editingCode = null;

    let codes = loadCodes();
    let activeCodeId = null;
    let currentFile = null;
    let pendingSelection = null;
    let codeSearchTerm = "";

    // ---- Draggable modals ----------------------------------------------------
    function makeDraggable(handle) {
        const box = handle.closest(".modal-box");
        if (!box) return;
        handle.classList.add("draggable-handle");
        let dragging = false, offsetX = 0, offsetY = 0;
        handle.addEventListener("mousedown", (e) => {
            dragging = true;
            const rect = box.getBoundingClientRect();
            offsetX = e.clientX - rect.left;
            offsetY = e.clientY - rect.top;
            box.style.position = "fixed";
            box.style.margin = "0";
            box.style.left = rect.left + "px";
            box.style.top = rect.top + "px";
            e.preventDefault();
        });
        window.addEventListener("mousemove", (e) => {
            if (!dragging) return;
            box.style.left = Math.max(0, e.clientX - offsetX) + "px";
            box.style.top = Math.max(0, e.clientY - offsetY) + "px";
        });
        window.addEventListener("mouseup", () => {
            dragging = false;
        });
    }

    function resetModalPosition(handle) {
        const box = handle.closest(".modal-box");
        if (!box) return;
        box.style.position = "";
        box.style.left = "";
        box.style.top = "";
        box.style.margin = "";
    }

    [modalTitle, quotesModalTitle, quoteCodesModalTitle, aiApplyModalTitle, codebookPickerTitle].forEach(makeDraggable);

    // ---- Persistence helpers ------------------------------------------------
    function loadCodes() {
        try {
            const raw = localStorage.getItem(CODES_KEY);
            if (raw) return JSON.parse(raw);
        } catch (e) { }
        return [];
    }
    function saveCodes() {
        localStorage.setItem(CODES_KEY, JSON.stringify(codes));
    }
    function loadHighlights(file) {
        try {
            const raw = localStorage.getItem(highlightsKey(file));
            if (raw) return JSON.parse(raw);
        } catch (e) { }
        return [];
    }
    function saveHighlights(file, list) {
        localStorage.setItem(highlightsKey(file), JSON.stringify(list));
    }

    // ---- Code manager UI ------------------------------------------------------
    function renderCodeList() {
        codeListEl.innerHTML = "";
        const term = codeSearchTerm.trim().toLowerCase();
        const codeMatches = (c) =>
            !term ||
            c.name.toLowerCase().includes(term) ||
            (c.definition || "").toLowerCase().includes(term);
        const categories = [];
        codes.forEach((code) => {
            const cat = code.category || "Newly added";
            if (!categories.includes(cat)) categories.push(cat);
        });
        let anyMatched = false;
        categories.forEach((cat) => {
            const matchingCodes = codes.filter((c) => (c.category || "Newly added") === cat && codeMatches(c));
            if (!matchingCodes.length) return;
            anyMatched = true;
            const group = document.createElement("div");
            group.className = "code-group";
            const heading = document.createElement("div");
            heading.className = "code-group-heading";
            heading.textContent = cat;
            group.appendChild(heading);
            const chipWrap = document.createElement("div");
            chipWrap.className = "code-group-chips";
            matchingCodes.forEach((code) => {
                const chip = document.createElement("div");
                chip.className = "code-chip" + (code.id === activeCodeId ? " active" : "");
                chip.draggable = true;
                if (code.definition) chip.setAttribute("data-tooltip", code.definition);
                chip.innerHTML =
                    '<span class="swatch" style="background:' + code.color + '" title="Click to change this code\'s color"></span>' +
                    '<span class="label"></span>' +
                    '<span class="del" title="Delete code">✕</span>';
                chip.querySelector(".label").textContent = code.name;
                const swatch = chip.querySelector(".swatch");
                const colorInput = document.createElement("input");
                colorInput.type = "color";
                colorInput.className = "chip-color-input";
                colorInput.value = code.color;
                colorInput.addEventListener("click", (e) => e.stopPropagation());
                colorInput.addEventListener("input", (e) => {
                    code.color = e.target.value;
                    swatch.style.background = code.color;
                    saveCodes();
                    updateHighlightColorsForCode(code);
                    renderCodingsList();
                });
                chip.appendChild(colorInput);
                swatch.addEventListener("click", (e) => {
                    e.stopPropagation();
                    colorInput.click();
                });
                chip.addEventListener("click", (e) => {
                    if (e.target.classList.contains("del") || e.target === swatch || e.target === colorInput) return;
                    if (pendingSelection) {
                        const { start, end, text } = pendingSelection;
                        setPendingSelection(null);
                        addHighlightForCode(code, start, end, text);
                        const sel = window.getSelection();
                        if (sel) sel.removeAllRanges();
                        return;
                    }
                    openQuotesModal(code);
                });
                chip.querySelector(".del").addEventListener("click", (e) => {
                    e.stopPropagation();
                    if (!confirm('Delete code "' + code.name + '"? Existing highlights made with it will keep their color but lose the code link.')) return;
                    codes = codes.filter((c) => c.id !== code.id);
                    if (activeCodeId === code.id) activeCodeId = null;
                    saveCodes();
                    renderCodeList();
                });
                chip.addEventListener("dragstart", (e) => {
                    e.dataTransfer.setData("text/plain", code.id);
                    e.dataTransfer.effectAllowed = "move";
                    chip.classList.add("dragging");
                });
                chip.addEventListener("dragend", () => {
                    chip.classList.remove("dragging");
                });
                chip.addEventListener("contextmenu", (e) => {
                    e.preventDefault();
                    showCodeContextMenu(e.clientX, e.clientY, code);
                });
                chipWrap.appendChild(chip);
            });
            chipWrap.addEventListener("dragover", (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                chipWrap.classList.add("drag-over");
            });
            chipWrap.addEventListener("dragleave", () => {
                chipWrap.classList.remove("drag-over");
            });
            chipWrap.addEventListener("drop", (e) => {
                e.preventDefault();
                chipWrap.classList.remove("drag-over");
                const id = e.dataTransfer.getData("text/plain");
                moveCodeToCategory(id, cat);
            });
            group.appendChild(chipWrap);
            codeListEl.appendChild(group);
        });
        if (!anyMatched && term) {
            codeListEl.innerHTML = '<p class="empty-note">No codes match "' + escapeHtml(codeSearchTerm.trim()) + '".</p>';
        }
        activeCodeBanner.innerHTML = activeCodeId
            ? "Active code: <strong>" + escapeHtml(codes.find((c) => c.id === activeCodeId).name) + "</strong> — select text in the transcript to apply it."
            : "Highlight text, then click a code to apply it. Click a code with nothing selected to see its quotes.";
        renderCodeFrequencyChart();
    }

    function moveCodeToCategory(id, cat) {
        const code = codes.find((c) => c.id === id);
        if (!code || (code.category || "Newly added") === cat) return;
        code.category = cat;
        saveCodes();
        renderCodeList();
    }

    function currentCategories() {
        const categories = [];
        codes.forEach((c) => {
            const cat = c.category || "Newly added";
            if (!categories.includes(cat)) categories.push(cat);
        });
        return categories;
    }

    // `prefill` (optional) starts the form from another coder's code:
    // { color, category, definition, onClose }. onClose runs when the modal
    // closes, whether the code was added or not.
    function openCodeModal(name, prefill) {
        prefill = prefill || {};
        pendingCode = { name, fromPrefill: !!prefill.color, onClose: prefill.onClose };
        modalTitle.textContent = 'New code: "' + name + '"';
        modalConfirmBtn.textContent = "Add code";
        modalEditFields.style.display = "none";
        modalColor.value = prefill.color || newCodeColor;
        const category = prefill.category || "Newly added";
        fillCategoryOptions(category);
        if (modalCategory.value !== category) {
            // Their category isn't one of mine yet: offer it as a new one.
            modalCategory.value = "__new__";
            modalNewCategory.value = category;
            modalNewCategoryWrap.style.display = "block";
        }
        modalDefinition.value = prefill.definition || "";
        modalBackdrop.style.display = "flex";
        modalDefinition.focus();
    }

    function openEditCodeModal(code) {
        editingCode = code;
        modalTitle.textContent = 'Edit code: "' + code.name + '"';
        modalConfirmBtn.textContent = "Save changes";
        modalEditFields.style.display = "block";
        modalName.value = code.name;
        modalColor.value = code.color;
        fillCategoryOptions(code.category || "Newly added");
        modalDefinition.value = code.definition || "";
        modalBackdrop.style.display = "flex";
        modalName.focus();
    }

    function fillCategoryOptions(selected) {
        modalCategory.innerHTML = "";
        const categories = currentCategories();
        if (!categories.includes("Newly added")) categories.unshift("Newly added");
        categories.forEach((cat) => {
            const opt = document.createElement("option");
            opt.value = cat;
            opt.textContent = cat;
            modalCategory.appendChild(opt);
        });
        const newOpt = document.createElement("option");
        newOpt.value = "__new__";
        newOpt.textContent = "+ New category…";
        modalCategory.appendChild(newOpt);
        modalCategory.value = selected;
        modalNewCategory.value = "";
        modalNewCategoryWrap.style.display = "none";
    }

    function closeCodeModal() {
        modalBackdrop.style.display = "none";
        const onClose = pendingCode && pendingCode.onClose;
        pendingCode = null;
        editingCode = null;
        resetModalPosition(modalTitle);
        if (onClose) onClose();
    }

    function openQuotesModal(code) {
        const entries = [];
        TRANSCRIPTS.forEach((t) => {
            loadHighlights(t.file).forEach((h) => {
                if (h.codeName === code.name) {
                    entries.push({
                        id: h.id,
                        file: t.file,
                        text: h.text,
                        transcriptLabel: t.label,
                        paragraph: h.paragraph,
                        color: h.color,
                    });
                }
            });
        });
        quotesModalTitle.textContent = 'Quotes coded: "' + code.name + '" (' + entries.length + ')';
        quotesModalList.innerHTML = "";
        if (!entries.length) {
            quotesModalList.innerHTML = '<p class="empty-note">No quotes have been coded with this code yet.</p>';
        } else {
            entries.forEach((entry) => {
                const item = document.createElement("div");
                item.className = "quote-item clickable";
                item.title = "Click to jump to this quote in the transcript";
                item.style.borderLeftColor = entry.color;
                const q = document.createElement("span");
                q.className = "quote-text";
                q.textContent = '"' + entry.text.trim() + '"';
                const source = document.createElement("span");
                source.className = "quote-source";
                source.textContent = "— " + entry.transcriptLabel + ", ¶" + (entry.paragraph || "?");
                item.appendChild(q);
                item.appendChild(source);
                item.addEventListener("click", () => {
                    scrollToHighlight(entry.file, entry.id);
                });
                quotesModalList.appendChild(item);
            });
        }
        quotesModalBackdrop.style.display = "flex";
    }

    async function scrollToHighlight(file, highlightId) {
        if (file !== currentFile) {
            const targetEntry = TRANSCRIPTS.find((t) => t.file === file);
            if (!targetEntry) return;
            transcriptSelect.value = String(TRANSCRIPTS.indexOf(targetEntry));
            await loadTranscript(targetEntry);
        }
        const mark = transcriptPane.querySelector('mark[data-highlight-id="' + highlightId + '"]');
        if (!mark) return;
        mark.scrollIntoView({ behavior: "smooth", block: "center" });
        mark.classList.add("flash-highlight");
        setTimeout(() => mark.classList.remove("flash-highlight"), 1500);
    }

    function closeQuotesModal() {
        quotesModalBackdrop.style.display = "none";
        resetModalPosition(quotesModalTitle);
    }

    function openQuoteCodesModal(highlightIds) {
        let entries = loadHighlights(currentFile)
            .filter((h) => highlightIds.includes(h.id))
            .sort((a, b) => a.start - b.start);

        function render() {
            if (!entries.length) {
                closeQuoteCodesModal();
                return;
            }
            quoteCodesModalTitle.textContent = "Codes on this quote (" + entries.length + ")";
            quoteCodesModalList.innerHTML = "";
            entries.forEach((h) => {
                const item = document.createElement("div");
                item.className = "coding-item";
                item.style.borderLeftColor = h.color;
                item.innerHTML =
                    '<div class="meta"><div class="code-name"></div><div class="excerpt"></div></div>' +
                    '<span class="remove" title="Remove this code from this quote">✕</span>';
                item.querySelector(".code-name").textContent = h.codeName;
                item.querySelector(".excerpt").textContent =
                    h.text.length > 140 ? h.text.slice(0, 140) + "…" : h.text;
                item.querySelector(".remove").addEventListener("click", () => {
                    removeHighlight(h.id);
                    entries = entries.filter((e) => e.id !== h.id);
                    render();
                });
                quoteCodesModalList.appendChild(item);
            });
        }

        render();
        quoteCodesModalBackdrop.style.display = "flex";
    }

    function closeQuoteCodesModal() {
        quoteCodesModalBackdrop.style.display = "none";
        resetModalPosition(quoteCodesModalTitle);
    }

    // ---- AI-assisted coding -------------------------------------------------
    let aiApplyCode = null;

    function showCodeContextMenu(x, y, code) {
        contextMenuCode = code;
        codeContextMenu.style.left = x + "px";
        codeContextMenu.style.top = y + "px";
        codeContextMenu.style.display = "block";
    }

    function hideCodeContextMenu() {
        codeContextMenu.style.display = "none";
        contextMenuCode = null;
    }

    document.addEventListener("click", (e) => {
        if (codeContextMenu.style.display !== "none" && !codeContextMenu.contains(e.target)) {
            hideCodeContextMenu();
        }
    });

    document.addEventListener("contextmenu", (e) => {
        if (!e.target.closest(".code-chip")) hideCodeContextMenu();
    });

    contextEditCodeBtn.addEventListener("click", () => {
        const code = contextMenuCode;
        hideCodeContextMenu();
        if (code) openEditCodeModal(code);
    });

    contextApplyCodeBtn.addEventListener("click", () => {
        const code = contextMenuCode;
        hideCodeContextMenu();
        if (code) startAiApply(code);
    });

    function renderAiSuggestions(skippedCount) {
        aiApplyModalBody.innerHTML = "";
        if (skippedCount) {
            const note = document.createElement("p");
            note.className = "ai-apply-status";
            note.textContent = skippedCount + " suggestion(s) could not be located verbatim in the transcript and were skipped.";
            aiApplyModalBody.appendChild(note);
        }
        aiSuggestions.forEach((s) => {
            s.selected = true;
            const item = document.createElement("label");
            item.className = "ai-suggestion-item";
            item.innerHTML =
                '<input type="checkbox" checked>' +
                '<span><span class="quote-text"></span><span class="quote-source"></span></span>';
            item.querySelector("input").addEventListener("change", (e) => {
                s.selected = e.target.checked;
            });
            item.querySelector(".quote-text").textContent = '"' + s.text.trim() + '"';
            item.querySelector(".quote-source").textContent = "¶" + s.paragraph;
            aiApplyModalBody.appendChild(item);
        });
    }

    async function startAiApply(code) {
        if (!currentFile) {
            alert("Select a transcript first.");
            return;
        }
        aiApplyCode = code;
        aiSuggestions = [];
        aiApplyModalTitle.textContent = 'Apply "' + code.name + '" with AI';
        aiApplyModalBody.innerHTML = '<p class="ai-apply-status">Asking AI to find quotes for this code in the transcript… this can take a bit for long transcripts.</p>';
        aiApplyConfirmBtn.style.display = "none";
        aiApplyModalBackdrop.style.display = "flex";

        const transcriptText = transcriptPane.textContent;
        let data;
        try {
            const resp = await fetch("/api/apply-code", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    transcriptText,
                    codeName: code.name,
                    codeDefinition: code.definition || "",
                }),
            });
            data = await resp.json();
            if (!resp.ok || !data.ok) throw new Error(data.error || "Request failed");
        } catch (err) {
            aiApplyModalBody.innerHTML =
                '<p class="ai-apply-status error">Could not get suggestions: ' + escapeHtml(err.message) +
                ". Make sure you started the app with <code>python3 server.py</code> (not the plain http.server) " +
                "and that ANTHROPIC_API_KEY is set on that server.</p>";
            return;
        }

        const existing = loadHighlights(currentFile);
        const seen = new Set();
        const matched = [];
        let skipped = 0;
        (data.quotes || []).forEach((q) => {
            const quote = String(q).trim();
            if (!quote) { skipped++; return; }
            const located = locateQuote(transcriptText, quote);
            if (!located) { skipped++; return; }
            const { start, end, text } = located;
            const key = start + ":" + end;
            if (seen.has(key)) return;
            const alreadyCoded = existing.some((h) => h.codeId === code.id && h.start === start && h.end === end);
            if (alreadyCoded) return;
            seen.add(key);
            matched.push({ text, start, end, paragraph: paragraphNumberForOffset(start) });
        });

        if (!matched.length) {
            aiApplyModalBody.innerHTML =
                '<p class="ai-apply-status">No new quotes found for this code' +
                (skipped ? " (" + skipped + " suggestion(s) could not be located verbatim and were skipped)" : "") +
                ".</p>";
            return;
        }

        aiSuggestions = matched;
        renderAiSuggestions(skipped);
        aiApplyConfirmBtn.style.display = "";
    }

    function closeAiApplyModal() {
        aiApplyModalBackdrop.style.display = "none";
        aiSuggestions = [];
        aiApplyCode = null;
        resetModalPosition(aiApplyModalTitle);
    }

    aiApplyCancelBtn.addEventListener("click", closeAiApplyModal);

    aiApplyConfirmBtn.addEventListener("click", () => {
        const code = aiApplyCode;
        if (!code) return;
        const toApply = aiSuggestions.filter((s) => s.selected !== false);
        toApply.forEach((s) => addHighlightForCode(code, s.start, s.end, s.text));
        statusEl.textContent = "Applied " + toApply.length + ' quote(s) for "' + code.name + '".';
        closeAiApplyModal();
    });

    modalCategory.addEventListener("change", () => {
        modalNewCategoryWrap.style.display = modalCategory.value === "__new__" ? "block" : "none";
    });

    modalCancelBtn.addEventListener("click", closeCodeModal);

    quotesModalCloseBtn.addEventListener("click", closeQuotesModal);

    quoteCodesModalCloseBtn.addEventListener("click", closeQuoteCodesModal);

    // Top-right "×" close button on every modal
    function addModalCloseButton(backdrop, closeFn) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "modal-close-x";
        btn.setAttribute("aria-label", "Close");
        btn.textContent = "\u00d7";
        btn.addEventListener("click", closeFn);
        backdrop.querySelector(".modal-box").appendChild(btn);
    }
    [
        [modalBackdrop, closeCodeModal],
        [quotesModalBackdrop, closeQuotesModal],
        [quoteCodesModalBackdrop, closeQuoteCodesModal],
        [aiApplyModalBackdrop, closeAiApplyModal],
        [codebookPickerBackdrop, closeCodebookPickerModal],
    ].forEach(([backdrop, closeFn]) => addModalCloseButton(backdrop, closeFn));

    document.addEventListener("keydown", (e) => {
        if (e.key !== "Escape") return;
        if (modalBackdrop.style.display !== "none") closeCodeModal();
        if (quotesModalBackdrop.style.display !== "none") closeQuotesModal();
        if (quoteCodesModalBackdrop.style.display !== "none") closeQuoteCodesModal();
        if (aiApplyModalBackdrop.style.display !== "none") closeAiApplyModal();
        if (codebookPickerBackdrop.style.display !== "none") closeCodebookPickerModal();
        if (codeContextMenu.style.display !== "none") hideCodeContextMenu();
    });

    modalConfirmBtn.addEventListener("click", () => {
        let category = modalCategory.value;
        if (category === "__new__") {
            category = modalNewCategory.value.trim() || "Newly added";
        }
        if (editingCode) {
            saveCodeEdits(editingCode, category);
            return;
        }
        if (!pendingCode) return;
        const id = "c" + Date.now() + Math.random().toString(36).slice(2, 7);
        if (!pendingCode.fromPrefill) {
            newCodeColor = modalColor.value;
            newCodeName.value = "";
            newCodeNameClearBtn.style.display = "none";
        }
        codes.push({
            id,
            name: pendingCode.name,
            color: modalColor.value,
            category,
            definition: modalDefinition.value.trim(),
            dateAdded: todayIso(),
        });
        saveCodes();
        renderCodeList();
        closeCodeModal();
    });

    codeForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const name = newCodeName.value.trim();
        if (!name) return;
        openCodeModal(name);
    });

    // Shows the ✕ button while the input has text; clicking it empties the input.
    function attachClearButton(input, clearBtn, onChange) {
        input.addEventListener("input", () => {
            clearBtn.style.display = input.value ? "block" : "none";
            onChange();
        });
        clearBtn.addEventListener("click", () => {
            input.value = "";
            clearBtn.style.display = "none";
            onChange();
            input.focus();
        });
    }

    attachClearButton(codeSearchInput, codeSearchClearBtn, () => {
        codeSearchTerm = codeSearchInput.value;
        renderCodeList();
    });

    attachClearButton(newCodeName, newCodeNameClearBtn, () => { });

    // ---- Research questions -------------------------------------------------
    // Shown in the header; click a question to edit it in place. Stored in
    // localStorage so edits survive a reload.

    function loadResearchQuestions() {
        try {
            const list = JSON.parse(localStorage.getItem(RESEARCH_QUESTIONS_KEY));
            if (Array.isArray(list)) return list;
        } catch (e) { }
        return [];
    }

    function saveResearchQuestions() {
        localStorage.setItem(RESEARCH_QUESTIONS_KEY, JSON.stringify(researchQuestions));
    }

    function renderResearchQuestions(focusIndex) {
        rqListEl.innerHTML = "";
        if (!researchQuestions.length) {
            const hint = document.createElement("span");
            hint.className = "rq-empty-note";
            hint.textContent = "No research questions yet. Add them one at a time, or load a .txt file with one question per line.";
            rqListEl.appendChild(hint);
        }
        researchQuestions.forEach((text, i) => {
            const item = document.createElement("span");
            item.className = "rq-item";

            const label = document.createElement("strong");
            label.textContent = "RQ" + (i + 1);

            const textEl = document.createElement("span");
            textEl.className = "rq-text";
            textEl.contentEditable = "plaintext-only";
            textEl.spellcheck = true;
            textEl.title = "Click to edit";
            textEl.dataset.placeholder = "Type a research question…";
            textEl.textContent = text;
            textEl.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    textEl.blur();
                } else if (e.key === "Escape") {
                    textEl.textContent = researchQuestions[i];
                    textEl.blur();
                }
            });
            textEl.addEventListener("blur", () => {
                const value = textEl.textContent.replace(/\s+/g, " ").trim();
                textEl.textContent = value;
                if (value === researchQuestions[i]) return;
                researchQuestions[i] = value;
                saveResearchQuestions();
            });

            const deleteBtn = document.createElement("button");
            deleteBtn.type = "button";
            deleteBtn.className = "rq-delete-btn";
            deleteBtn.title = "Delete RQ" + (i + 1);
            deleteBtn.textContent = "✕";
            deleteBtn.addEventListener("click", () => {
                if (researchQuestions[i] && !confirm("Delete RQ" + (i + 1) + "?\n\n" + researchQuestions[i])) return;
                researchQuestions.splice(i, 1);
                saveResearchQuestions();
                renderResearchQuestions();
            });

            item.append(label, ": ", textEl, deleteBtn);
            rqListEl.appendChild(item);

            if (i === focusIndex) textEl.focus();
        });
    }

    rqAddBtn.addEventListener("click", () => {
        researchQuestions.push("");
        saveResearchQuestions();
        renderResearchQuestions(researchQuestions.length - 1);
    });

    // Loads a .txt file with one research question per line, replacing the
    // current list. Blank lines and leading "RQ1:" / "1." labels are dropped.
    rqLoadBtn.addEventListener("click", () => rqLoadInput.click());

    rqLoadInput.addEventListener("change", async () => {
        const file = rqLoadInput.files[0];
        rqLoadInput.value = "";
        if (!file) return;
        const lines = (await file.text())
            .split(/\r?\n/)
            .map((line) => line.replace(/^\s*(RQ\s*\d+\s*[:.)\-]?|\d+\s*[:.)\-])\s*/i, "").replace(/\s+/g, " ").trim())
            .filter(Boolean);
        if (!lines.length) {
            alert("No research questions found in " + file.name + ". Put one question per line.");
            return;
        }
        if (researchQuestions.some(Boolean) &&
            !confirm("Replace the current " + researchQuestions.length + " research question(s) with the " + lines.length + " in " + file.name + "?")) return;
        researchQuestions = lines;
        saveResearchQuestions();
        renderResearchQuestions();
        statusEl.textContent = "Loaded " + lines.length + " research question(s) from " + file.name + ".";
    });

    renderResearchQuestions();

    // ---- Transcript loading ---------------------------------------------------
    // Loaded transcripts keep their rendered HTML in localStorage so they stay
    // in the dropdown (with their codings) after reload.
    function loadUploadedTranscripts() {
        try {
            return JSON.parse(localStorage.getItem(UPLOADED_TRANSCRIPTS_KEY)) || [];
        } catch (e) {
            return [];
        }
    }

    function saveUploadedTranscripts() {
        try {
            localStorage.setItem(UPLOADED_TRANSCRIPTS_KEY, JSON.stringify(TRANSCRIPTS));
        } catch (e) {
            alert("This transcript is too large to remember after a reload. It will work for now, but you will need to load it again next time.");
        }
    }

    function addTranscriptOption(t, i) {
        const opt = document.createElement("option");
        opt.value = String(i);
        opt.textContent = t.label;
        transcriptSelect.appendChild(opt);
    }

    TRANSCRIPTS.push(...loadUploadedTranscripts());
    TRANSCRIPTS.forEach(addTranscriptOption);

    loadTranscriptBtn.addEventListener("click", () => loadTranscriptInput.click());

    loadTranscriptInput.addEventListener("change", async () => {
        const file = loadTranscriptInput.files[0];
        loadTranscriptInput.value = "";
        if (!file) return;
        const type = /\.docx$/i.test(file.name) ? "docx" : "txt";
        let html;
        try {
            html = type === "docx"
                ? await docxToHtml(await file.arrayBuffer())
                : textToHtml(await file.text());
        } catch (err) {
            alert("Could not read that file: " + err.message);
            return;
        }
        let entry = TRANSCRIPTS.find((t) => t.file === file.name);
        if (entry) {
            entry.html = html;
        } else {
            entry = { label: file.name.replace(/\.(docx|txt)$/i, ""), file: file.name, type, html };
            TRANSCRIPTS.push(entry);
            addTranscriptOption(entry, TRANSCRIPTS.length - 1);
        }
        saveUploadedTranscripts();
        transcriptSelect.value = String(TRANSCRIPTS.indexOf(entry));
        loadTranscript(entry);
    });

    transcriptSelect.addEventListener("change", () => {
        const idx = transcriptSelect.value;
        if (idx === "") return;
        loadTranscript(TRANSCRIPTS[Number(idx)]);
    });

    function escapeHtml(str) {
        return str.replace(/[&<>"']/g, (c) => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
        }[c]));
    }

    function todayIso() {
        return new Date().toISOString().slice(0, 10);
    }

    function highlightStyle(color) {
        const hex = (color || "#cccccc").replace("#", "");
        const r = parseInt(hex.slice(0, 2), 16) || 0;
        const g = parseInt(hex.slice(2, 4), 16) || 0;
        const b = parseInt(hex.slice(4, 6), 16) || 0;
        return "background-color: rgba(" + r + "," + g + "," + b + ",0.35); border-bottom: 3px solid " + color + ";";
    }

    // ---- Choosing a codebook to load ----------------------------------------
    const CODEBOOK_DIR = "codes/";
    const CODEBOOK_FILENAME_RE = /^\d{6}-\d{4}-codebook\.csv$/i;

    async function findAllCodebookFiles() {
        try {
            const resp = await fetch(CODEBOOK_DIR);
            if (!resp.ok) return [];
            const html = await resp.text();
            const names = Array.from(html.matchAll(/href="([^"]+)"/g), (m) => decodeURIComponent(m[1]));
            const matches = names.filter((n) => CODEBOOK_FILENAME_RE.test(n));
            matches.sort().reverse(); // newest first
            return matches;
        } catch (e) {
            return [];
        }
    }

    function parseCsv(text) {
        const rows = [];
        let row = [], field = "", inQuotes = false;
        for (let i = 0; i < text.length; i++) {
            const c = text[i];
            if (inQuotes) {
                if (c === '"') {
                    if (text[i + 1] === '"') { field += '"'; i++; }
                    else { inQuotes = false; }
                } else {
                    field += c;
                }
            } else if (c === '"') {
                inQuotes = true;
            } else if (c === ",") {
                row.push(field); field = "";
            } else if (c === "\n") {
                row.push(field); rows.push(row); row = []; field = "";
            } else if (c === "\r") {
                // ignore; \n handles the line break
            } else {
                field += c;
            }
        }
        if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
        return rows;
    }

    function codesFromCsvRows(rows) {
        if (!rows.length) return [];
        const header = rows[0].map((h) => h.trim().toLowerCase());
        const idx = (name) => header.indexOf(name);
        const codeIdx = idx("code");
        const defIdx = idx("definition");
        const catIdx = idx("category");
        const colorIdx = idx("color");
        const firstUsedIdx = idx("first time used in");
        const dateAddedIdx = idx("date added");
        if (codeIdx === -1) return [];
        const result = [];
        for (let r = 1; r < rows.length; r++) {
            const row = rows[r];
            if (!row || !row.length) continue;
            const name = (row[codeIdx] || "").trim();
            if (!name) continue;
            const category = (catIdx !== -1 ? row[catIdx] : "").trim() || "Newly added";
            result.push({
                name,
                definition: defIdx !== -1 ? (row[defIdx] || "").trim() : "",
                category,
                color: colorIdx !== -1 ? (row[colorIdx] || "").trim() : "",
                firstUsedIn: firstUsedIdx !== -1 ? (row[firstUsedIdx] || "").trim() : "",
                dateAdded: dateAddedIdx !== -1 ? (row[dateAddedIdx] || "").trim() : "",
            });
        }
        return result;
    }

    // Fully replaces the current code list with `importedList`, keeping the
    // existing id for any code matched by name (so renaming/recoloring and any
    // highlights already applied under that code stay linked) and generating a
    // fresh id for anything genuinely new in the picked codebook.
    function replaceCodesFromParsedList(importedList) {
        const byName = new Map(codes.map((c) => [c.name, c]));
        codes = importedList.map((imp) => {
            const existing = byName.get(imp.name);
            const id = existing ? existing.id : "c" + Date.now() + Math.random().toString(36).slice(2, 7);
            return {
                id,
                name: imp.name,
                color: imp.color || CATEGORY_COLORS[imp.category] || "#cccccc",
                category: imp.category || "Newly added",
                definition: imp.definition || "",
                firstUsedIn: imp.firstUsedIn || "",
                dateAdded: imp.dateAdded || "",
            };
        });
        activeCodeId = null;
        saveCodes();
        renderCodeList();
    }

    async function openCodebookPickerModal() {
        const hasSaved = !!localStorage.getItem(CODES_KEY);
        codebookPickerList.innerHTML = '<p class="empty-note">Looking for saved codebooks…</p>';
        codebookPickerBackdrop.style.display = "flex";

        const files = await findAllCodebookFiles();

        codebookPickerList.innerHTML = "";
        const addOption = (label, sublabel, onClick) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "codebook-picker-item";
            btn.innerHTML = "<span class=\"label\"></span>" + (sublabel ? "<span class=\"sublabel\"></span>" : "");
            btn.querySelector(".label").textContent = label;
            if (sublabel) btn.querySelector(".sublabel").textContent = sublabel;
            btn.addEventListener("click", onClick);
            codebookPickerList.appendChild(btn);
        };

        if (hasSaved) {
            addOption("Keep my current codes", codes.length + " code(s), as last saved in this browser", () => {
                closeCodebookPickerModal();
            });
        }

        files.forEach((filename) => {
            addOption(filename, "codes/" + filename, async () => {
                try {
                    const resp = await fetch(CODEBOOK_DIR + encodeURIComponent(filename));
                    if (!resp.ok) throw new Error("HTTP " + resp.status);
                    const text = await resp.text();
                    const imported = codesFromCsvRows(parseCsv(text));
                    if (!imported.length) throw new Error("No codes found in that file");
                    replaceCodesFromParsedList(imported);
                    statusEl.textContent = "Loaded codebook: " + filename;
                    closeCodebookPickerModal();
                } catch (err) {
                    alert("Could not load that codebook: " + err.message);
                }
            });
        });

        addOption("Browse for a file…", "Pick any codebook CSV from your computer", () => {
            codebookPickerFileInput.click();
        });
    }

    function closeCodebookPickerModal() {
        codebookPickerBackdrop.style.display = "none";
        resetModalPosition(codebookPickerTitle);
    }

    codebookPickerFileInput.addEventListener("change", async () => {
        const file = codebookPickerFileInput.files[0];
        codebookPickerFileInput.value = "";
        if (!file) return;
        try {
            const text = await file.text();
            const imported = codesFromCsvRows(parseCsv(text));
            if (!imported.length) throw new Error("No codes found in that file");
            replaceCodesFromParsedList(imported);
            statusEl.textContent = "Loaded codebook: " + file.name;
            closeCodebookPickerModal();
        } catch (err) {
            alert("Could not load that file: " + err.message);
        }
    });

    async function docxToHtml(arrayBuffer) {
        const result = await mammoth.convertToHtml({ arrayBuffer });
        if (result.messages && result.messages.length) {
            console.warn("mammoth messages:", result.messages);
        }
        return result.value || "<p><em>(empty document)</em></p>";
    }

    function textToHtml(text) {
        return text
            .split(/\r?\n/)
            .map((line) => (line.trim() ? "<p>" + escapeHtml(line) + "</p>" : ""))
            .join("");
    }

    async function loadTranscript(entry) {
        compare.exit();
        currentFile = entry.file;
        pendingSelection = null;
        transcriptPane.innerHTML = '<p class="placeholder">Loading “' + entry.label + '”…</p>';
        statusEl.textContent = "";
        transcriptPane.innerHTML = entry.html;
        applySavedHighlights();
        renderCodingsList();
        statusEl.textContent = "Loaded: " + entry.file;
    }

    // ---- Offset-based highlight engine -----------------------------------
    function getOffsets(container, range) {
        const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
        let node, total = 0, start = null, end = null;
        while ((node = walker.nextNode())) {
            const len = node.nodeValue.length;
            if (node === range.startContainer) start = total + range.startOffset;
            if (node === range.endContainer) end = total + range.endOffset;
            total += len;
        }
        return { start, end };
    }

    function wrapOffsets(container, start, end, attrs) {
        const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
        let node, total = 0;
        const toWrap = [];
        while ((node = walker.nextNode())) {
            const len = node.nodeValue.length;
            const nodeStart = total, nodeEnd = total + len;
            total += len;
            const overlapStart = Math.max(start, nodeStart);
            const overlapEnd = Math.min(end, nodeEnd);
            if (overlapStart < overlapEnd) {
                toWrap.push({ node, from: overlapStart - nodeStart, to: overlapEnd - nodeStart });
            }
        }
        toWrap.forEach(({ node, from, to }) => {
            const r = document.createRange();
            r.setStart(node, from);
            r.setEnd(node, to);
            const mark = document.createElement("mark");
            mark.className = "coded-highlight";
            Object.entries(attrs).forEach(([k, v]) => mark.setAttribute(k, v));
            r.surroundContents(mark);
        });
    }

    function applySavedHighlights() {
        const list = loadHighlights(currentFile).slice().sort((a, b) => a.start - b.start);
        list.forEach((h) => {
            wrapOffsets(transcriptPane, h.start, h.end, {
                "data-highlight-id": h.id,
                "data-code-id": h.codeId,
                style: highlightStyle(h.color),
                title: h.codeName,
            });
        });
    }

    function paragraphLabelFor(el, index) {
        const first = el.firstElementChild;
        if (first && first.tagName === "SUP") {
            const n = first.textContent.trim();
            if (n) return n;
        }
        return String(index + 1);
    }

    function paragraphNumberForOffset(offset) {
        const children = Array.from(transcriptPane.children);
        let total = 0;
        for (let i = 0; i < children.length; i++) {
            const len = (children[i].textContent || "").length;
            if (offset < total + len || i === children.length - 1) return paragraphLabelFor(children[i], i);
            total += len;
        }
        return children.length ? paragraphLabelFor(children[children.length - 1], children.length - 1) : "1";
    }

    function addHighlightForCode(code, start, end, text) {
        if (!code.firstUsedIn) {
            const entry = TRANSCRIPTS.find((t) => t.file === currentFile);
            code.firstUsedIn = entry ? entry.label : currentFile;
            saveCodes();
        }
        const list = loadHighlights(currentFile);
        const id = "h" + Date.now() + Math.random().toString(36).slice(2, 7);
        const paragraph = paragraphNumberForOffset(start);
        list.push({ id, start, end, codeId: code.id, codeName: code.name, color: code.color, text, paragraph });
        saveHighlights(currentFile, list);
        wrapOffsets(transcriptPane, start, end, {
            "data-highlight-id": id,
            "data-code-id": code.id,
            style: highlightStyle(code.color),
            title: code.name,
        });
        renderCodingsList();
    }

    function saveCodeEdits(code, category) {
        const trimmed = modalName.value.trim();
        if (!trimmed) {
            alert("The code name can't be empty.");
            return;
        }
        const collision = codes.find((c) => c.id !== code.id && c.name === trimmed);
        if (collision) {
            alert('A code named "' + trimmed + '" already exists. Choose a different name.');
            return;
        }
        const renamed = trimmed !== code.name;
        const recolored = modalColor.value !== code.color;
        code.definition = modalDefinition.value.trim();
        code.category = category;
        code.color = modalColor.value;
        if (renamed) {
            renameCode(code, trimmed);
        } else {
            saveCodes();
        }
        if (recolored) updateHighlightColorsForCode(code);
        closeCodeModal();
        renderCodeList();
        renderCodingsList();
        statusEl.textContent = 'Saved changes to code "' + trimmed + '".';
    }

    function renameCode(code, trimmed) {
        code.name = trimmed;
        saveCodes();
        TRANSCRIPTS.forEach((t) => {
            const list = loadHighlights(t.file);
            let changed = false;
            list.forEach((h) => {
                if (h.codeId === code.id) {
                    h.codeName = trimmed;
                    changed = true;
                }
            });
            if (changed) saveHighlights(t.file, list);
        });
        transcriptPane.querySelectorAll('mark[data-code-id="' + code.id + '"]').forEach((m) => {
            m.setAttribute("title", trimmed);
        });
    }

    function updateHighlightColorsForCode(code) {
        TRANSCRIPTS.forEach((t) => {
            const list = loadHighlights(t.file);
            let changed = false;
            list.forEach((h) => {
                if (h.codeId === code.id) {
                    h.color = code.color;
                    changed = true;
                }
            });
            if (changed) saveHighlights(t.file, list);
        });
        transcriptPane.querySelectorAll('mark[data-code-id="' + code.id + '"]').forEach((m) => {
            m.setAttribute("style", highlightStyle(code.color));
        });
    }

    function removeHighlight(id) {
        const list = loadHighlights(currentFile).filter((h) => h.id !== id);
        saveHighlights(currentFile, list);
        transcriptPane.querySelectorAll('mark[data-highlight-id="' + id + '"]').forEach((m) => {
            const parent = m.parentNode;
            while (m.firstChild) parent.insertBefore(m.firstChild, m);
            parent.removeChild(m);
            parent.normalize();
        });
        renderCodingsList();
    }

    // The pending selection gets its own visual marker in the transcript,
    // independent of the browser's native text selection. Native selection
    // disappears the moment focus moves elsewhere (e.g. clicking into the code
    // search box or the new-code-name field), which would otherwise make it
    // look like the selection was lost right when the user needs it most —
    // right before picking a code to apply it to.
    function clearPendingSelectionMarker() {
        transcriptPane.querySelectorAll("mark.pending-selection").forEach((m) => {
            const parent = m.parentNode;
            while (m.firstChild) parent.insertBefore(m.firstChild, m);
            parent.removeChild(m);
            parent.normalize();
        });
    }

    function setPendingSelection(sel) {
        pendingSelection = sel;
        // While comparing, selecting my text brings up the codes panel.
        if (sel && compare.isActive()) compare.openSidePane();
        clearPendingSelectionMarker();
        if (sel) wrapOffsets(transcriptPane, sel.start, sel.end, { class: "pending-selection" });
    }

    transcriptPane.addEventListener("mouseup", () => {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
            setPendingSelection(null);
            return;
        }
        const range = sel.getRangeAt(0);
        if (!transcriptPane.contains(range.commonAncestorContainer)) return;
        const text = range.toString();
        if (!text.trim()) { setPendingSelection(null); return; }
        const { start, end } = getOffsets(transcriptPane, range);
        if (start === null || end === null || end <= start) { setPendingSelection(null); return; }

        if (activeCodeId) {
            const code = codes.find((c) => c.id === activeCodeId);
            if (code) {
                addHighlightForCode(code, start, end, text);
                sel.removeAllRanges();
                setPendingSelection(null);
                return;
            }
        }
        // No active code: remember this selection so clicking a code next applies it here.
        setPendingSelection({ start, end, text });
        sel.removeAllRanges();
    });

    transcriptPane.addEventListener("click", (e) => {
        const highlightIds = [];
        let node = e.target;
        while (node && node !== transcriptPane) {
            if (node.nodeType === 1 && node.tagName === "MARK" && node.classList.contains("coded-highlight")) {
                highlightIds.push(node.dataset.highlightId);
            }
            node = node.parentElement;
        }
        if (!highlightIds.length) return;
        openQuoteCodesModal(highlightIds);
    });

    // ---- Code frequency heatmap -----------------------------------------------
    // Rows are codes; columns are the open transcript, then every other
    // transcript, then the total. Cell shade scales with the count (blue
    // gradient, shared scale across all per-transcript cells).
    function heatColor(n, max) {
        if (!n) return null;
        const t = n / max;
        const light = [222, 235, 252];
        const dark = [24, 72, 160];
        const rgb = light.map((l, i) => Math.round(l + (dark[i] - l) * t));
        return { bg: "rgb(" + rgb.join(",") + ")", fg: t > 0.5 ? "#fff" : "#1b2b4a" };
    }

    function renderCodeFrequencyChart() {
        const current = TRANSCRIPTS.find((t) => t.file === currentFile);
        const columns = (current ? [current] : []).concat(TRANSCRIPTS.filter((t) => t !== current));

        const counts = new Map();
        const rowFor = (name) => {
            if (!counts.has(name)) counts.set(name, { name, cells: columns.map(() => 0), total: 0 });
            return counts.get(name);
        };
        codes.forEach((c) => rowFor(c.name));
        columns.forEach((t, col) => {
            loadHighlights(t.file).forEach((h) => {
                const row = rowFor(h.codeName);
                row.cells[col]++;
                row.total++;
            });
        });

        const rows = [...counts.values()].sort(
            (a, b) => b.total - a.total || (b.cells[0] || 0) - (a.cells[0] || 0) || a.name.localeCompare(b.name)
        );
        if (!rows.length) {
            codeFreqChartEl.innerHTML = '<p class="empty-note">No codes yet.</p>';
            return;
        }
        const max = Math.max(1, ...rows.flatMap((r) => r.cells));

        const table = document.createElement("table");
        table.className = "freq-table";
        const headRow = table.createTHead().insertRow();
        const addTh = (text, title, className) => {
            const th = document.createElement("th");
            th.textContent = text;
            if (title) th.title = title;
            if (className) th.className = className;
            headRow.appendChild(th);
        };
        addTh("Code", "", "code-col");
        columns.forEach((t) => {
            const isCurrent = t === current;
            addTh(isCurrent ? "This transcript" : t.label, t.label, isCurrent ? "current-col" : "");
        });
        addTh("Total", "Across all transcripts", "total-col");

        const body = table.createTBody();
        rows.forEach((r) => {
            const code = codes.find((c) => c.name === r.name);
            const tr = body.insertRow();
            if (!r.total) tr.className = "unused";
            const nameCell = tr.insertCell();
            nameCell.className = "code-col";
            nameCell.innerHTML = '<span class="swatch"></span><span class="name"></span>';
            nameCell.querySelector(".swatch").style.background = code ? code.color : "#ccc";
            nameCell.querySelector(".name").textContent = r.name;
            nameCell.title = r.name;
            if (code) {
                nameCell.classList.add("clickable");
                nameCell.addEventListener("click", () => openQuotesModal(code));
            }
            r.cells.forEach((n, col) => {
                const td = tr.insertCell();
                td.className = "heat-cell";
                td.textContent = n;
                td.title = r.name + " — " + n + " in " + columns[col].label;
                const color = heatColor(n, max);
                if (color) {
                    td.style.background = color.bg;
                    td.style.color = color.fg;
                }
            });
            const totalCell = tr.insertCell();
            totalCell.className = "total-col";
            totalCell.textContent = r.total;
        });

        codeFreqChartEl.innerHTML = "";
        codeFreqChartEl.appendChild(table);
    }

    function renderCodingsList() {
        renderCodeFrequencyChart();
        if (compare.isActive()) compare.refresh();
        const list = currentFile ? loadHighlights(currentFile).sort((a, b) => a.start - b.start) : [];
        if (!list.length) {
            codingsListEl.innerHTML = '<p class="empty-note">Nothing coded yet.</p>';
            return;
        }
        codingsListEl.innerHTML = "";
        list.forEach((h) => {
            const item = document.createElement("div");
            item.className = "coding-item";
            item.style.borderLeftColor = h.color;
            item.innerHTML =
                '<div class="meta"><div class="code-name"></div><div class="excerpt"></div></div>' +
                '<span class="remove" title="Remove">✕</span>';
            const codeNameEl = item.querySelector(".code-name");
            codeNameEl.textContent = h.codeName;
            const matchedCode = codes.find((c) => c.name === h.codeName);
            if (matchedCode) {
                codeNameEl.classList.add("clickable");
                codeNameEl.title = "Show all quotes coded with this code";
                codeNameEl.addEventListener("click", (e) => {
                    e.stopPropagation();
                    openQuotesModal(matchedCode);
                });
            }
            item.querySelector(".excerpt").textContent =
                h.text.length > 140 ? h.text.slice(0, 140) + "…" : h.text;
            item.querySelector(".remove").addEventListener("click", () => removeHighlight(h.id));
            item.addEventListener("mouseenter", () => {
                const els = transcriptPane.querySelectorAll('mark[data-highlight-id="' + h.id + '"]');
                els.forEach((el) => (el.style.outline = "2px solid #333"));
            });
            item.addEventListener("mouseleave", () => {
                const els = transcriptPane.querySelectorAll('mark[data-highlight-id="' + h.id + '"]');
                els.forEach((el) => (el.style.outline = ""));
            });
            codingsListEl.appendChild(item);
        });
    }

    clearBtn.addEventListener("click", () => {
        if (!currentFile) return;
        if (!confirm("Remove ALL codings for this transcript? This cannot be undone.")) return;
        saveHighlights(currentFile, []);
        loadTranscript(TRANSCRIPTS[Number(transcriptSelect.value)]);
    });

    function buildCodingsCsv(transcriptEntries) {
        const rows = [["file", "code", "category", "quotes", "transcript", "paragraph"]];
        transcriptEntries.forEach((t) => {
            loadHighlights(t.file).forEach((h) => {
                const matchedCode = codes.find((c) => c.name === h.codeName);
                const category = matchedCode ? (matchedCode.category || "Newly added") : "";
                const quote = '"' + h.text.trim() + '"';
                rows.push([t.label, h.codeName, category, quote, t.label, h.paragraph || ""]);
            });
        });
        return rows
            .map((r) => r.map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(","))
            .join("\n");
    }

    function downloadCsv(csv, filename) {
        const blob = new Blob([csv], { type: "text/csv" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
    }

    exportBtn.addEventListener("click", () => {
        downloadCsv(buildCodingsCsv(TRANSCRIPTS), filenameTimestamp() + "-transcript-codings.csv");
    });

    exportTranscriptBtn.addEventListener("click", () => {
        if (!currentFile) {
            alert("Select a transcript first.");
            return;
        }
        const entry = TRANSCRIPTS.find((t) => t.file === currentFile);
        const csv = buildCodingsCsv(entry ? [entry] : []);
        const filename = (entry ? entry.label : currentFile) + " - codings.csv";
        downloadCsv(csv, filename);
    });

    // "4 - Karen (17), 3 - Scott (10)": transcripts using the code, most uses first.
    function transcriptUsageByCode() {
        const usage = new Map();
        TRANSCRIPTS.forEach((t) => {
            loadHighlights(t.file).forEach((h) => {
                if (!usage.has(h.codeName)) usage.set(h.codeName, new Map());
                const perFile = usage.get(h.codeName);
                perFile.set(t.label, (perFile.get(t.label) || 0) + 1);
            });
        });
        const summaries = new Map();
        usage.forEach((perFile, codeName) => {
            summaries.set(
                codeName,
                [...perFile]
                    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
                    .map(([label, n]) => label + " (" + n + ")")
                    .join(", ")
            );
        });
        return summaries;
    }

    function buildCodebookCsv() {
        const usage = transcriptUsageByCode();
        const rows = [["Code", "Definition", "Category", "Color", "First time used in", "Date added", "Transcripts"]].concat(
            codes.map((c) => [
                c.name,
                c.definition || "",
                c.category || "Newly added",
                c.color || "",
                c.firstUsedIn || "",
                c.dateAdded || "",
                usage.get(c.name) || "",
            ])
        );
        return rows
            .map((r) => r.map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(","))
            .join("\n");
    }

    // "yymmdd-hhmin" timestamp shared by exported filenames.
    function filenameTimestamp() {
        const now = new Date();
        const pad = (n) => String(n).padStart(2, "0");
        const yy = pad(now.getFullYear() % 100);
        const mm = pad(now.getMonth() + 1);
        const dd = pad(now.getDate());
        const hh = pad(now.getHours());
        const min = pad(now.getMinutes());
        return yy + mm + dd + "-" + hh + min;
    }
    function suggestedCodebookFilename() {
        return filenameTimestamp() + "-codebook.csv";
    }

    saveCodebookBtn.addEventListener("click", async () => {
        const csv = buildCodebookCsv();
        const filename = suggestedCodebookFilename();
        const blob = new Blob([csv], { type: "text/csv" });

        if (window.showSaveFilePicker) {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName: filename,
                    types: [{ description: "CSV file", accept: { "text/csv": [".csv"] } }],
                });
                const writable = await handle.createWritable();
                await writable.write(blob);
                await writable.close();
                statusEl.textContent = "Saved codebook to " + (handle.name || filename) + ".";
                return;
            } catch (e) {
                if (e && e.name === "AbortError") {
                    statusEl.textContent = "Save cancelled.";
                    return;
                }
                console.warn("Save picker failed, falling back to download.", e);
            }
        }

        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
        statusEl.textContent = "Downloaded " + filename + " (this browser can't prompt for a save location).";
    });

    // ---- Apply codes from a codings CSV file --------------------------------
    function stripQuoteMarks(s) {
        s = String(s).trim();
        if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) return s.slice(1, -1);
        return s;
    }

    // Normalizes case and common "smart" punctuation variants without changing
    // string length, so an index found in the normalized text is still a valid
    // index into the original text.
    function normalizeForMatch(s) {
        return s
            .toLowerCase()
            .replace(/[‘’ʼ]/g, "'")
            .replace(/[“”]/g, '"')
            .replace(/[–—]/g, "-");
    }

    // Finds `quote` inside `transcriptText`. Tries an exact match first; if that
    // fails (e.g. a code file capitalized the first letter of a mid-sentence
    // quote, or used straight vs. curly quotes/dashes), falls back to a
    // case-and-punctuation-insensitive match. Returns the ACTUAL transcript
    // text at that position (not the possibly-altered input quote), since
    // that's what should be highlighted and stored.
    function locateQuote(transcriptText, quote) {
        let idx = transcriptText.indexOf(quote);
        if (idx !== -1) return { start: idx, end: idx + quote.length, text: quote };
        const normText = normalizeForMatch(transcriptText);
        const normQuote = normalizeForMatch(quote);
        idx = normText.indexOf(normQuote);
        if (idx === -1) return null;
        const end = idx + quote.length;
        return { start: idx, end, text: transcriptText.slice(idx, end) };
    }

    applyFromFileBtn.addEventListener("click", () => {
        if (!currentFile) {
            alert("Select a transcript first.");
            return;
        }
        applyFromFileInput.click();
    });

    applyFromFileInput.addEventListener("change", async () => {
        const file = applyFromFileInput.files[0];
        applyFromFileInput.value = "";
        if (!file) return;

        const entry = TRANSCRIPTS.find((t) => t.file === currentFile);
        const currentLabel = entry ? entry.label : currentFile;

        let text;
        try {
            text = await file.text();
        } catch (e) {
            alert("Could not read that file.");
            return;
        }

        const rows = parseCsv(text);
        if (rows.length < 2) {
            alert("That file doesn't look like a codings CSV (no data rows found).");
            return;
        }
        const header = rows[0].map((h) => h.trim().toLowerCase());
        const idx = (names) => {
            for (const n of names) {
                const i = header.indexOf(n);
                if (i !== -1) return i;
            }
            return -1;
        };
        const fileIdx = idx(["file", "transcript"]);
        const codeIdx = idx(["code"]);
        const categoryIdx = idx(["category"]);
        const quotesIdx = idx(["quotes", "quote", "excerpt"]);

        if (codeIdx === -1 || quotesIdx === -1) {
            alert('That file is missing a "code" or "quotes" column.');
            return;
        }

        const dataRows = rows.slice(1).filter((r) => r.length && r.some((v) => v.trim() !== ""));
        if (!dataRows.length) {
            alert("That file has no data rows.");
            return;
        }

        if (fileIdx !== -1) {
            const fileValue = (dataRows[0][fileIdx] || "").trim();
            if (fileValue && fileValue !== currentLabel) {
                alert('Wrong code file: this file is for "' + fileValue + '", but the loaded transcript is "' + currentLabel + '".');
                return;
            }
        }

        const transcriptText = transcriptPane.textContent;
        const existingHighlights = loadHighlights(currentFile);
        const newCodeNames = new Set();
        let applied = 0;
        let skipped = 0;
        let overlapSkipped = 0;

        const skippedRows = [];

        // Tracks, per code, every range it already covers (pre-existing + newly
        // applied this run) so the same code is never stacked on a quote — or any
        // overlapping part of one — that it's already applied to.
        const rangesOverlap = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && bStart < aEnd;
        const rangesByCode = new Map();
        existingHighlights.forEach((h) => {
            if (!rangesByCode.has(h.codeId)) rangesByCode.set(h.codeId, []);
            rangesByCode.get(h.codeId).push([h.start, h.end]);
        });

        dataRows.forEach((row) => {
            const codeName = (row[codeIdx] || "").trim();
            const quoteRaw = row[quotesIdx] || "";
            const quote = stripQuoteMarks(quoteRaw);
            if (!codeName || !quote) { skipped++; return; }

            let code = codes.find((c) => c.name === codeName);
            if (!code) {
                const category = categoryIdx !== -1 ? (row[categoryIdx] || "").trim() || "Newly added" : "Newly added";
                code = {
                    id: "c" + Date.now() + Math.random().toString(36).slice(2, 7),
                    name: codeName,
                    color: CATEGORY_COLORS[category] || "#cccccc",
                    category,
                    dateAdded: todayIso(),
                };
                codes.push(code);
                newCodeNames.add(codeName);
            }

            const located = locateQuote(transcriptText, quote);
            if (!located) {
                skipped++;
                skippedRows.push(codeName + ': "' + quote.slice(0, 80) + (quote.length > 80 ? "…" : "") + '"');
                return;
            }
            const { start, end, text } = located;

            const existingRanges = rangesByCode.get(code.id) || [];
            const alreadyCovered = existingRanges.some(([rs, re]) => rangesOverlap(start, end, rs, re));
            if (alreadyCovered) {
                overlapSkipped++;
                return;
            }

            if (!rangesByCode.has(code.id)) rangesByCode.set(code.id, []);
            rangesByCode.get(code.id).push([start, end]);
            addHighlightForCode(code, start, end, text);
            applied++;
        });

        saveCodes();
        renderCodeList();

        statusEl.textContent =
            "Applied " + applied + " quote(s) from file" +
            (newCodeNames.size ? " (" + newCodeNames.size + " new code(s) created)" : "") +
            (skipped ? ", " + skipped + " skipped (not found in this transcript)" : "") +
            (overlapSkipped ? ", " + overlapSkipped + " skipped (already had that code)" : "") +
            ".";

        if (skippedRows.length) {
            console.warn("Apply codes from file — quotes not found in transcript:", skippedRows);
            const preview = skippedRows.slice(0, 15).join("\n");
            const more = skippedRows.length > 15 ? "\n…and " + (skippedRows.length - 15) + " more (see browser console for the full list)." : "";
            alert(
                skippedRows.length + " quote(s) could not be found in this transcript and were skipped:\n\n" +
                preview + more
            );
        }
    });

    // ---- Compare with someone else's coding (see compare.js) -----------------
    const compare = setupCompare({
        get codes() { return codes; },
        get currentFile() { return currentFile; },
        get username() { return username; },
        TRANSCRIPTS,
        CATEGORY_COLORS,
        transcriptPane,
        transcriptSelect,
        statusEl,
        quotesModal: { backdrop: quotesModalBackdrop, title: quotesModalTitle, list: quotesModalList },
        quoteCodesModal: { backdrop: quoteCodesModalBackdrop, title: quoteCodesModalTitle, list: quoteCodesModalList },
        closeQuoteCodesModal,
        openCodeModal,
        makeDraggable,
        resetModalPosition,
        addModalCloseButton,
        loadTranscript,
        loadHighlights,
        wrapOffsets,
        highlightStyle,
        escapeHtml,
        parseCsv,
        codesFromCsvRows,
        stripQuoteMarks,
        locateQuote,
    });

    renderCodeList();
    openCodebookPickerModal();
})();
