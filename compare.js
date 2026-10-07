// ---- Compare with someone else's coding ------------------------------------
// Loads another coder's codebook and codings CSV and shows the same transcript
// twice: my codings on the left, theirs on the right. Their files are only
// displayed; nothing of theirs is saved or merged into my codes (except a code
// I explicitly add to my codebook from one of their quotes).
//
// app.js calls setupCompare() with the shared state and helpers it needs
// (`codes` and `currentFile` are getters, since app.js reassigns them) and
// gets back the hooks it calls into while comparing.
function setupCompare(app) {
    const {
        TRANSCRIPTS, CATEGORY_COLORS, transcriptPane, transcriptSelect, statusEl,
        quotesModal, quoteCodesModal, closeQuoteCodesModal, openCodeModal,
        makeDraggable, resetModalPosition, addModalCloseButton, loadTranscript,
        loadHighlights, wrapOffsets, highlightStyle, escapeHtml, parseCsv,
        codesFromCsvRows, stripQuoteMarks, locateQuote,
    } = app;

    const COMPARE_NAME_KEY = "transcript-coder:compare-name";

    // Set while comparing.
    let compareState = null;

    const compareBtn = document.getElementById("compare-btn");
    const compareModalBackdrop = document.getElementById("compare-modal-backdrop");
    const compareModalTitle = document.getElementById("compare-modal-title");
    const compareNameInput = document.getElementById("compare-name-input");
    const compareCodebookInput = document.getElementById("compare-codebook-input");
    const compareCodingsInput = document.getElementById("compare-codings-input");
    const compareModalNote = document.getElementById("compare-modal-note");
    const compareCancelBtn = document.getElementById("compare-cancel-btn");
    const compareConfirmBtn = document.getElementById("compare-confirm-btn");
    const compareBar = document.getElementById("compare-bar");
    const compareMineLabel = document.getElementById("compare-mine-label");
    const compareMineCount = document.getElementById("compare-mine-count");
    const compareTheirsLabel = document.getElementById("compare-theirs-label");
    const compareTheirsCount = document.getElementById("compare-theirs-count");
    const compareDiffsToggle = document.getElementById("compare-diffs-toggle");
    const compareSummaryBtn = document.getElementById("compare-summary-btn");
    const compareSideBtn = document.getElementById("compare-side-btn");
    const compareExitBtn = document.getElementById("compare-exit-btn");
    const comparePane = document.getElementById("compare-pane");
    const layoutEl = document.getElementById("layout");

    function openCompareModal() {
        compareCodebookInput.value = "";
        compareCodingsInput.value = "";
        compareNameInput.value = localStorage.getItem(COMPARE_NAME_KEY) || "";
        const entry = TRANSCRIPTS.find((t) => t.file === app.currentFile);
        compareModalNote.textContent = entry
            ? "If their codings are for a different transcript you have loaded, that one opens instead of “" + entry.label + "”."
            : "The transcript they coded must be loaded here too (use “Load transcript…” first if it isn't in the dropdown).";
        compareModalBackdrop.style.display = "flex";
        compareNameInput.focus();
    }

    function otherCoderPossessive() {
        const name = compareState && compareState.name;
        return name ? name + "’s" : "Their";
    }

    function closeCompareModal() {
        compareModalBackdrop.style.display = "none";
        resetModalPosition(compareModalTitle);
    }

    compareBtn.addEventListener("click", openCompareModal);
    compareCancelBtn.addEventListener("click", closeCompareModal);
    makeDraggable(compareModalTitle);
    addModalCloseButton(compareModalBackdrop, closeCompareModal);
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && compareModalBackdrop.style.display !== "none") closeCompareModal();
    });

    function sameCodeOverlap(a, b) {
        return a.codeName === b.codeName && a.start < b.end && b.start < a.end;
    }

    // Their code's color: my color for a code I also have (so the same code
    // looks the same on both sides), else their codebook's, else the category's.
    function theirCodeColor(codeName, category, theirCodebook) {
        const mine = app.codes.find((c) => c.name === codeName);
        if (mine) return mine.color;
        const theirs = theirCodebook.get(codeName);
        const cat = (theirs && theirs.category) || category;
        return (theirs && theirs.color) || CATEGORY_COLORS[cat] || "#cccccc";
    }

    compareConfirmBtn.addEventListener("click", async () => {
        const codingsFile = compareCodingsInput.files[0];
        const codebookFile = compareCodebookInput.files[0];
        const otherName = compareNameInput.value.trim();
        localStorage.setItem(COMPARE_NAME_KEY, otherName);
        if (!codingsFile) {
            alert("Choose their codings CSV.");
            return;
        }

        let theirCodebook = new Map();
        if (codebookFile) {
            try {
                const imported = codesFromCsvRows(parseCsv(await codebookFile.text()));
                if (!imported.length) throw new Error("no codes found (it needs a \"Code\" column)");
                theirCodebook = new Map(imported.map((c) => [c.name, c]));
            } catch (err) {
                alert("Could not read their codebook: " + err.message);
                return;
            }
        }

        const rows = parseCsv(await codingsFile.text());
        const header = (rows[0] || []).map((h) => h.trim().toLowerCase());
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
            alert('Their codings file is missing a "code" or "quotes" column.');
            return;
        }
        const dataRows = rows.slice(1).filter((r) => r.length && r.some((v) => v.trim() !== ""));
        if (!dataRows.length) {
            alert("Their codings file has no data rows.");
            return;
        }

        // Pick the transcript: the open one if their file covers it, otherwise
        // any loaded transcript their file covers.
        const rowLabel = (r) => (fileIdx === -1 ? "" : (r[fileIdx] || "").trim());
        const labels = [...new Set(dataRows.map(rowLabel).filter(Boolean))];
        const currentEntry = TRANSCRIPTS.find((t) => t.file === app.currentFile);
        let entry;
        if (!labels.length) {
            entry = currentEntry;
            if (!entry) {
                alert("Their codings file doesn't say which transcript it is for. Open that transcript first, then compare.");
                return;
            }
        } else {
            entry = currentEntry && labels.includes(currentEntry.label)
                ? currentEntry
                : labels.map((label) => TRANSCRIPTS.find((t) => t.label === label)).find(Boolean);
            if (!entry) {
                const forWhat = labels.length === 1 ? '"' + labels[0] + '"' : labels.length + " transcripts (" + labels.join(", ") + ")";
                if (!currentEntry) {
                    alert("Their codings are for " + forWhat + ", which isn't loaded here. Load that transcript first (“Load transcript…”), then compare.");
                    return;
                }
                if (!confirm("Their codings are for " + forWhat + ", which isn't loaded here.\n\nCompare them against the open transcript “" + currentEntry.label + "” anyway?")) return;
                entry = currentEntry;
            }
        }
        const theirRows = labels.includes(entry.label) ? dataRows.filter((r) => rowLabel(r) === entry.label) : dataRows;

        closeCompareModal();
        if (entry.file !== app.currentFile) {
            transcriptSelect.value = String(TRANSCRIPTS.indexOf(entry));
            await loadTranscript(entry);
        }

        comparePane.innerHTML = entry.html;
        const transcriptText = comparePane.textContent;
        const theirs = [];
        const notFound = [];
        theirRows.forEach((row, i) => {
            const codeName = (row[codeIdx] || "").trim();
            const quote = stripQuoteMarks(row[quotesIdx] || "");
            if (!codeName || !quote) return;
            const located = locateQuote(transcriptText, quote);
            if (!located) {
                notFound.push({ codeName, quote });
                return;
            }
            const category = categoryIdx !== -1 ? (row[categoryIdx] || "").trim() : "";
            theirs.push({
                id: "t" + i,
                codeName,
                start: located.start,
                end: located.end,
                text: located.text,
                color: theirCodeColor(codeName, category, theirCodebook),
            });
        });
        theirs.slice().sort((a, b) => a.start - b.start).forEach((h) => {
            wrapOffsets(comparePane, h.start, h.end, {
                "data-their-id": h.id,
                style: highlightStyle(h.color),
                title: h.codeName,
            });
        });

        compareState = { entry, theirs, notFound, theirCodebook, name: otherName, codingsName: codingsFile.name };
        compareTheirsLabel.textContent = otherCoderPossessive() + " coding";
        compareTheirsLabel.title = codingsFile.name + (codebookFile ? " + " + codebookFile.name : "");
        layoutEl.classList.add("compare-mode");
        layoutEl.classList.toggle("show-diffs", compareDiffsToggle.checked);
        comparePane.style.display = "";
        compareBar.style.display = "";
        comparePane.scrollTop = transcriptPane.scrollTop;
        refreshCompareView();
        statusEl.textContent = "Comparing “" + entry.label + "” with " + (otherName || codingsFile.name) +
            (notFound.length ? " (" + notFound.length + " of " + (otherName ? otherName + "’s" : "their") + " quotes not found in this transcript)" : "") + ".";
    });

    // Updates the counts in the comparison bar and marks, on both sides, the
    // codings the other coder did not also apply.
    function refreshCompareView() {
        const mine = loadHighlights(app.currentFile);
        const { theirs, notFound } = compareState;
        compareMineLabel.textContent = app.username ? app.username + "’s coding" : "My coding";
        compareMineCount.textContent = mine.length + " coding(s)";
        compareTheirsCount.textContent = theirs.length + " coding(s)" +
            (notFound.length ? ", " + notFound.length + " not found in this transcript" : "");
        mine.forEach((h) => {
            const unmatched = !theirs.some((t) => sameCodeOverlap(h, t));
            transcriptPane.querySelectorAll('mark[data-highlight-id="' + h.id + '"]')
                .forEach((el) => el.classList.toggle("compare-unmatched", unmatched));
        });
        theirs.forEach((t) => {
            const unmatched = !mine.some((h) => sameCodeOverlap(h, t));
            comparePane.querySelectorAll('mark[data-their-id="' + t.id + '"]')
                .forEach((el) => el.classList.toggle("compare-unmatched", unmatched));
        });
    }

    function setCompareSidePaneOpen(open) {
        layoutEl.classList.toggle("compare-side-open", open);
        compareSideBtn.textContent = open ? "Hide codes panel" : "Show codes panel";
    }

    compareSideBtn.addEventListener("click", () => {
        setCompareSidePaneOpen(!layoutEl.classList.contains("compare-side-open"));
    });

    function exitCompare() {
        if (!compareState) return;
        compareState = null;
        setCompareSidePaneOpen(false);
        layoutEl.classList.remove("compare-mode", "show-diffs");
        comparePane.style.display = "none";
        comparePane.innerHTML = "";
        compareBar.style.display = "none";
        transcriptPane.querySelectorAll("mark.compare-unmatched").forEach((el) => el.classList.remove("compare-unmatched"));
    }

    compareExitBtn.addEventListener("click", () => {
        exitCompare();
        statusEl.textContent = "";
    });

    compareDiffsToggle.addEventListener("change", () => {
        layoutEl.classList.toggle("show-diffs", compareDiffsToggle.checked);
    });

    // Keep both copies of the transcript scrolled to the same place. The echo
    // scroll event from the other pane lands on the same position and stops.
    function syncScroll(from, to) {
        from.addEventListener("scroll", () => {
            if (!compareState) return;
            const fromMax = from.scrollHeight - from.clientHeight;
            const toMax = to.scrollHeight - to.clientHeight;
            const target = fromMax > 0 ? (from.scrollTop / fromMax) * toMax : 0;
            if (Math.abs(to.scrollTop - target) > 1) to.scrollTop = target;
        });
    }
    syncScroll(transcriptPane, comparePane);
    syncScroll(comparePane, transcriptPane);

    // Clicking their highlight lists their codes on that spot. A code I don't
    // have yet can be added to my codebook through the usual new-code form,
    // prefilled with their definition, category and color.
    function openTheirQuoteCodesModal(ids) {
        const entries = compareState.theirs.filter((t) => ids.includes(t.id)).sort((a, b) => a.start - b.start);
        quoteCodesModal.title.textContent = otherCoderPossessive() + " codes on this quote (" + entries.length + ")";
        quoteCodesModal.list.innerHTML = "";
        entries.forEach((t) => {
            const item = document.createElement("div");
            item.className = "coding-item";
            item.style.borderLeftColor = t.color;
            item.innerHTML = '<div class="meta"><div class="code-name"></div><div class="excerpt"></div></div>';
            const def = (compareState.theirCodebook.get(t.codeName) || {}).definition;
            item.querySelector(".code-name").textContent = t.codeName + (def ? " — " + def : "");
            item.querySelector(".excerpt").textContent = t.text.length > 140 ? t.text.slice(0, 140) + "…" : t.text;
            if (app.codes.some((c) => c.name === t.codeName)) {
                const note = document.createElement("span");
                note.className = "in-codebook-note";
                note.textContent = "In my codebook";
                item.appendChild(note);
            } else {
                const addBtn = document.createElement("button");
                addBtn.type = "button";
                addBtn.className = "btn add-to-codebook-btn";
                addBtn.textContent = "Add to my codebook";
                addBtn.addEventListener("click", () => {
                    const theirs = compareState.theirCodebook.get(t.codeName) || {};
                    closeQuoteCodesModal();
                    openCodeModal(t.codeName, {
                        color: t.color,
                        category: theirs.category,
                        definition: theirs.definition,
                        onClose: () => {
                            if (compareState) openTheirQuoteCodesModal(ids);
                        },
                    });
                });
                item.appendChild(addBtn);
            }
            quoteCodesModal.list.appendChild(item);
        });
        quoteCodesModal.backdrop.style.display = "flex";
    }

    comparePane.addEventListener("click", (e) => {
        const ids = [];
        for (let node = e.target; node && node !== comparePane; node = node.parentElement) {
            if (node.tagName === "MARK" && node.dataset.theirId) ids.push(node.dataset.theirId);
        }
        if (!ids.length || !compareState) return;
        openTheirQuoteCodesModal(ids);
    });

    // Per code: how often each of us used it in this transcript, and how many
    // of my codings they also applied (same code on overlapping text).
    compareSummaryBtn.addEventListener("click", () => {
        if (!compareState) return;
        const mine = loadHighlights(app.currentFile);
        const { theirs, notFound, name: otherName } = compareState;
        const other = otherName || "they";
        const names = [...new Set(mine.map((h) => h.codeName).concat(theirs.map((t) => t.codeName)))];
        const stats = names.map((name) => {
            const m = mine.filter((h) => h.codeName === name);
            const t = theirs.filter((x) => x.codeName === name);
            const shared = m.filter((h) => t.some((x) => sameCodeOverlap(h, x))).length;
            const myCode = app.codes.find((c) => c.name === name);
            const color = myCode ? myCode.color : (t[0] && t[0].color) || "#cccccc";
            return { name, mine: m.length, theirs: t.length, shared, color };
        }).sort((a, b) => (b.mine + b.theirs) - (a.mine + a.theirs) || a.name.localeCompare(b.name));

        quotesModal.title.textContent = "Code-by-code comparison: " + compareState.entry.label;
        quotesModal.list.innerHTML = "";
        if (!stats.length) {
            quotesModal.list.innerHTML = '<p class="empty-note">Neither of you has coded this transcript yet.</p>';
        } else {
            const table = document.createElement("table");
            table.className = "compare-summary-table";
            table.innerHTML = "<thead><tr><th>Code</th><th></th><th></th>" +
                '<th title="My codings of this code that ' + escapeHtml(other) + ' also applied to overlapping text">Shared</th></tr></thead>';
            table.querySelectorAll("th")[1].textContent = app.username || "Mine";
            table.querySelectorAll("th")[2].textContent = otherName || "Theirs";
            const tbody = document.createElement("tbody");
            stats.forEach((st) => {
                const tr = document.createElement("tr");
                if (st.shared !== st.mine || st.mine !== st.theirs) tr.className = "differs";
                tr.innerHTML = '<td><span class="swatch-dot"></span><span class="name"></span></td><td></td><td></td><td></td>';
                tr.querySelector(".swatch-dot").style.background = st.color;
                tr.querySelector(".name").textContent = st.name;
                const cells = tr.querySelectorAll("td");
                cells[1].textContent = st.mine;
                cells[2].textContent = st.theirs;
                cells[3].textContent = st.shared;
                tbody.appendChild(tr);
            });
            table.appendChild(tbody);
            quotesModal.list.appendChild(table);
            const note = document.createElement("p");
            note.className = "empty-note";
            note.textContent = "Shared = my codings of that code that " + other + " also applied to overlapping text. Codes where we differ are in bold.";
            quotesModal.list.appendChild(note);
        }
        if (notFound.length) {
            const heading = document.createElement("p");
            heading.className = "empty-note";
            heading.textContent = notFound.length + " of " + (otherName ? otherName + "’s" : "their") + " quote(s) could not be found in this transcript:";
            quotesModal.list.appendChild(heading);
            notFound.forEach((nf) => {
                const item = document.createElement("div");
                item.className = "quote-item";
                item.innerHTML = '<span class="quote-text"></span><span class="quote-source"></span>';
                item.querySelector(".quote-text").textContent = '"' + nf.quote + '"';
                item.querySelector(".quote-source").textContent = "— " + nf.codeName;
                quotesModal.list.appendChild(item);
            });
        }
        quotesModal.backdrop.style.display = "flex";
    });

    return {
        isActive: () => !!compareState,
        refresh: refreshCompareView,
        exit: exitCompare,
        openSidePane: () => setCompareSidePaneOpen(true),
    };
}
