/* ============================================================
   AIXaaS™ Query Panel — Client Logic
   Connects to MAO API: /api/chat, /api/ingest/*
   ============================================================ */

'use strict';

// ── Auth & Config ─────────────────────────────────────────────
const AUTH   = window.MAO_AUTH || '';
const USER   = window.MAO_USER || 'demo';
const ROLE   = window.MAO_ROLE || 'demo';

const API_HEADERS = {
    'Authorization': `Basic ${AUTH}`,
    'Content-Type':  'application/json',
};

// ── State ─────────────────────────────────────────────────────
let activeNamespace  = 'documents';  // default: maps to Foundation Demo option
let activeLabel      = 'Foundation Demo';
let isQuerying       = false;
let agentBusy        = false;
let lastADR          = null;
let lastResponseText = '';
let lastQueryText    = '';
let partnerBarOpen   = true;
const agentHistory   = [];  // {role, content}

// ── DOM refs ──────────────────────────────────────────────────
const $  = id  => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    initStatus();
    loadKBStatus();
    initDomains();
    initPatterns();
    initQueryBuilder();
    initAgent();
    initUpload();
    initADR();
    initActionButtons();
    initSuggestedActions();
    initPartnerBar();
    checkHealth();
});

// ── Health Check ──────────────────────────────────────────────
async function checkHealth() {
    try {
        const r = await fetch('/health');
        const d = await r.json();
        if (d.kb_ready) {
            setStatus('ready', `KB ready · ${(d.kb_chunk_count || d.chunk_count || 0).toLocaleString()} chunks · ${d.storage_mode || 'azure+keyword'}`);
        } else {
            setStatus('loading', 'Knowledge Base loading… please wait');
            setTimeout(checkHealth, 4000);
        }
    } catch {
        setStatus('error', 'Cannot reach MAO — check your connection');
    }
}

function setStatus(state, text) {
    const dot = $('statusDot');
    const txt = $('statusText');
    dot.className   = `qp-status-dot ${state}`;
    txt.textContent = text;
}

// ── Knowledge Domains (now a <select> in the nav) ─────────────

// Cache of per-namespace chunk counts (populated by loadKBStatus)
let _nsChunkCounts = {};

function initDomains() {
    const sel = $('domainSelect');
    if (!sel) return;

    sel.addEventListener('change', () => {
        const opt = sel.options[sel.selectedIndex];
        activeNamespace = sel.value;
        activeLabel     = opt.getAttribute('data-label') || opt.text;

        $('activeDomainLabel').textContent = activeLabel;
        $('agentDomainName').textContent   = activeLabel;
        $('modalDomainName').textContent   = activeLabel;
        resetResponse();

        // Empty domain guidance: warn when selected namespace has no data
        _showDomainGuidance(activeNamespace);
    });

    // Sync JS state with the HTML <select> default on page load
    activeNamespace = sel.value;
    activeLabel     = sel.options[sel.selectedIndex].getAttribute('data-label') || sel.options[sel.selectedIndex].text;
}

// Show/clear an inline notice beneath the query area when a domain has 0 chunks
function _showDomainGuidance(namespace) {
    let notice = $('domainEmptyNotice');
    const count = _nsChunkCounts[namespace];
    // count undefined = stats not loaded yet; count 0 = confirmed empty
    if (count !== 0) {
        if (notice) notice.remove();
        return;
    }
    if (!notice) {
        notice = document.createElement('div');
        notice.id        = 'domainEmptyNotice';
        notice.className = 'qp-domain-empty-notice';
        const qb = $('queryInput')?.closest('.qp-query-builder-card') || $('queryInput')?.parentElement;
        if (qb) qb.insertAdjacentElement('afterend', notice);
    }
    notice.innerHTML = `<span>&#128274; <strong>${escapeQP(activeLabel)}</strong> has no data yet.</span>`
        + `&ensp;<a href="/" style="color:var(--qp-accent,#38bdf8);text-decoration:none">&#8592; Upload files on the Dashboard</a> to get started.`;
}

function escapeQP(t) {
    const d = document.createElement('div');
    d.textContent = t;
    return d.innerHTML;
}

// Update <option> text in domain selector with live chunk counts
function _updateDomainCounts(ns) {
    const sel = $('domainSelect');
    if (!sel) return;
    Array.from(sel.options).forEach(opt => {
        const label  = opt.getAttribute('data-label') || '';
        const chunks = ns[opt.value]?.vectors;
        opt.text = chunks != null && chunks > 0
            ? `${label} · ${chunks.toLocaleString()} chunks`
            : label;
    });
}

// ── Pattern Categories (accordion) ────────────────────────────
function toggleCategory(categoryId) {
    const patterns = $(`patterns-${categoryId}`);
    const chevron  = $(`chev-${categoryId}`);
    if (!patterns) return;

    const isHidden = patterns.style.display === 'none';
    patterns.style.display = isHidden ? 'flex' : 'none';
    if (chevron) chevron.classList.toggle('rotated', !isHidden);
}

// ── Pattern Library ───────────────────────────────────────────
function initPatterns() {
    $$('.qp-pattern-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const q = btn.dataset.query;
            if (!q) return;
            $('queryInput').value = q;
            updateCharCount();
            $('queryInput').focus();
            // Visual flash feedback
            btn.classList.add('flash');
            setTimeout(() => btn.classList.remove('flash'), 600);
        });
    });
}

// ── Query Builder ─────────────────────────────────────────────
function initQueryBuilder() {
    const input    = $('queryInput');
    const submit   = $('submitBtn');
    const clearBtn = $('clearBtn');
    const uploadBtn = $('uploadBtn');

    input.addEventListener('input', updateCharCount);
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            runQuery();
        }
    });

    submit.addEventListener('click', runQuery);
    clearBtn.addEventListener('click', () => {
        input.value = '';
        updateCharCount();
        resetResponse();
    });

    if (uploadBtn) {
        uploadBtn.addEventListener('click', () => {
            $('uploadModal').style.display = 'flex';
        });
    }
}

function updateCharCount() {
    const len = $('queryInput').value.length;
    $('charCount').textContent = `${len.toLocaleString()} chars`;
}

// ── Run Query ─────────────────────────────────────────────────
async function runQuery() {
    if (isQuerying) return;
    const query = $('queryInput').value.trim();
    if (!query) {
        $('queryInput').focus();
        return;
    }

    lastQueryText = query;
    isQuerying    = true;
    setQueryUI(true);
    showLoading();
    const t0 = Date.now();

    try {
        const useStream = $('streamToggle').checked;
        if (useStream) {
            await runStreamQuery(query, t0);
        } else {
            await runBlockingQuery(query, t0);
        }
    } catch (err) {
        showError(err.message || 'Query failed — check console for details');
    } finally {
        isQuerying = false;
        setQueryUI(false);
    }
}

async function runStreamQuery(query, t0) {
    animatePipeline();

    const payload = {
        query,
        namespace: activeNamespace,
        top_k:     8,
        stream:    true,
    };

    const resp = await fetch('/api/chat', {
        method:  'POST',
        headers: API_HEADERS,
        body:    JSON.stringify(payload),
    });

    if (!resp.ok) {
        const err = await resp.json().catch(() => ({ detail: resp.statusText }));
        throw new Error(err.detail || `HTTP ${resp.status}`);
    }

    showResponseArea('');
    // Show live word counter in meta strip during streaming
    const metaEl = $('responseMeta');
    const tokenCountEl = $('metaTokens');
    if (metaEl) metaEl.style.display = 'flex';
    if (tokenCountEl) tokenCountEl.textContent = '0 words…';

    const responseTextEl = $('responseText');
    const reader   = resp.body.getReader();
    const decoder  = new TextDecoder();
    let   full     = '';
    let   sources  = [];
    let   rawBody  = '';  // accumulate raw body for JSON fallback

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        rawBody += chunk;

        const lines = chunk.split('\n');
        for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const raw = line.slice(6).trim();
            if (raw === '[DONE]') continue;
            try {
                const obj = JSON.parse(raw);
                if (obj.token)    { full += obj.token;    renderMarkdown(responseTextEl, full); }
                if (obj.response) { full = obj.response;  renderMarkdown(responseTextEl, full); }
                if (obj.sources)  { sources = obj.sources; }
                if (obj.adr_hash) lastADR = obj;
                if (obj.frameworks?.length) showComplianceBadges(obj.frameworks);
                // Update live word count during streaming
                if (tokenCountEl && (obj.token || obj.response)) {
                    const wc = full.split(/\s+/).filter(Boolean).length;
                    tokenCountEl.textContent = `${wc} words…`;
                }
            } catch { /* partial chunk */ }
        }
    }

    // Fallback: server returned plain JSON instead of SSE (chat.py does not yet stream)
    // Parse the accumulated body as regular JSON and extract the response field.
    if (!full && rawBody.trim().startsWith('{')) {
        try {
            const data = JSON.parse(rawBody);
            full    = data.response || data.answer || '';
            sources = data.sources  || [];
            if (data.adr_hash || data.model) lastADR = data;
        } catch { /* leave full empty */ }
    }

    if (!full) full = '[No response received — check that the namespace has content and try again]';
    renderMarkdown(responseTextEl, full);
    lastResponseText = full;
    finishResponse(t0, full, lastADR, sources);
}

async function runBlockingQuery(query, t0) {
    animatePipeline();

    const payload = {
        query,
        namespace: activeNamespace,
        top_k:     8,
    };

    const resp = await fetch('/api/chat', {
        method:  'POST',
        headers: API_HEADERS,
        body:    JSON.stringify(payload),
    });

    if (!resp.ok) {
        const err = await resp.json().catch(() => ({ detail: resp.statusText }));
        throw new Error(err.detail || `HTTP ${resp.status}`);
    }

    const data   = await resp.json();
    const text   = data.response || data.answer || JSON.stringify(data);
    const sources = data.sources || [];

    showResponseArea(text);
    renderMarkdown($('responseText'), text);

    if (data.adr_hash)    lastADR = data;
    if (data.frameworks?.length) showComplianceBadges(data.frameworks);

    lastResponseText = text;
    finishResponse(t0, text, data, sources);
}

// ── Pipeline Animation ────────────────────────────────────────
function animatePipeline() {
    const stages = ['stage1','stage2','stage3','stage4'];
    const delays = [0, 800, 1900, 3200];
    stages.forEach(s => $(s)?.classList.remove('active','done'));
    stages.forEach((s, i) => {
        setTimeout(() => {
            if (!isQuerying && i > 0) return;
            stages.slice(0, i).forEach(prev => {
                $(prev)?.classList.remove('active');
                $(prev)?.classList.add('done');
            });
            $(s)?.classList.add('active');
        }, delays[i]);
    });
}

function finishPipeline() {
    ['stage1','stage2','stage3','stage4'].forEach(s => {
        $(s)?.classList.remove('active');
        $(s)?.classList.add('done');
    });
}

// ── UI State Helpers ──────────────────────────────────────────
function setQueryUI(busy) {
    const btn = $('submitBtn');
    const lbl = $('submitLabel');
    btn.disabled    = busy;
    lbl.textContent = busy ? '⟳ Processing…' : '▶ Run Query';
}

function showLoading() {
    $('responseEmpty').style.display   = 'none';
    $('responseContent').style.display = 'none';
    $('responseLoading').style.display = 'flex';
    $('responseMeta').style.display    = 'none';
    $('responseSubtitle').textContent  = 'MAO agents processing your query…';
}

function showResponseArea(text) {
    $('responseLoading').style.display = 'none';
    $('responseContent').style.display = 'block';
    $('responseText').textContent      = text;
    finishPipeline();
}

function finishResponse(t0, text, meta, sources) {
    const elapsed   = ((Date.now() - t0) / 1000).toFixed(1);
    const wordCount = text.split(/\s+/).filter(Boolean).length;

    $('responseMeta').style.display   = 'flex';
    $('metaTime').textContent         = `${elapsed}s`;
    $('metaTokens').textContent       = `~${wordCount} words`;
    $('responseSubtitle').textContent = `Response · ${activeLabel} · ${elapsed}s`;

    // Store ADR internally (not shown in demo UI — accessible via /api/ingest/adr)
    if (meta?.adr_hash) {
        lastADR = meta;
        const adrIdEl = $('adrId');
        if (adrIdEl) adrIdEl.textContent = meta.adr_hash;
    }

    // Show sources
    if (sources && sources.length > 0) {
        showSources(sources);
    }

    // Extract & show key metrics
    showKeyMetrics(text);

    // Show action bar
    $('actionBar').style.display = 'flex';

    // Highlight dollar amounts
    highlightDollars($('responseText'));

    // Scroll only if response card is not already visible in viewport
    const rc = $('responseContent');
    const rect = rc.getBoundingClientRect();
    const inView = rect.top >= 0 && rect.bottom <= (window.innerHeight || document.documentElement.clientHeight);
    if (!inView) rc.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    // Add to agent context
    agentHistory.push({ role: 'user',      content: lastQueryText });
    agentHistory.push({ role: 'assistant', content: text });
}

function showError(msg) {
    $('responseLoading').style.display = 'none';
    $('responseContent').style.display = 'block';
    // Show error with a one-click retry button
    const retryId = 'errorRetryBtn';
    $('responseText').innerHTML = `
        <div style="color:#fca5a5;padding:.75rem 1rem;background:rgba(239,68,68,0.12);border-radius:7px;border:1px solid rgba(239,68,68,0.3);display:flex;flex-direction:column;gap:.6rem">
            <span><strong>Error:</strong> ${escapeHtml(msg)}</span>
            <button id="${retryId}" style="align-self:flex-start;padding:.3rem .8rem;background:rgba(239,68,68,0.18);border:1px solid rgba(239,68,68,0.4);border-radius:.4rem;color:#fca5a5;cursor:pointer;font-size:.82rem">
                ↻ Retry Query
            </button>
        </div>`;
    $('responseSubtitle').textContent = 'Query failed';
    // Wire retry button to re-run last query without clearing the input
    const retryBtn = $(retryId);
    if (retryBtn && lastQueryText) {
        retryBtn.addEventListener('click', () => {
            if (!isQuerying) runQuery();
        });
    }
}

function resetResponse() {
    $('responseEmpty').style.display   = 'flex';
    $('responseContent').style.display = 'none';
    $('responseLoading').style.display = 'none';
    $('responseMeta').style.display    = 'none';
    $('actionBar').style.display       = 'none';
    $('metricsGrid').style.display     = 'none';
    $('sourcesSection').style.display  = 'none';
    $('responseSubtitle').textContent  = 'Results will appear here after you run a query';
    $('complianceBadges').innerHTML    = '';
    lastResponseText = '';
}

// ── Sources Display ───────────────────────────────────────────
function showSources(sources) {
    if (!sources || sources.length === 0) return;
    const section = $('sourcesSection');
    const list    = $('sourcesList');
    const count   = $('sourcesCount');

    count.textContent = `${sources.length} source${sources.length > 1 ? 's' : ''}`;
    list.innerHTML = '';

    sources.slice(0, 5).forEach(src => {
        const score     = Math.round((src.score || 0) * 100);
        const name      = (src.source || 'unknown').split('/').pop();
        const excerpt   = src.excerpt || '';

        const item = document.createElement('div');
        item.className = 'qp-source-item';
        item.innerHTML = `
            <div class="qp-source-score-bar">
                <div class="qp-source-score-value">${score}%</div>
                <div class="qp-source-bar-track">
                    <div class="qp-source-bar-fill" style="width:${score}%"></div>
                </div>
            </div>
            <div class="qp-source-info">
                <div class="qp-source-name" title="${escapeHtml(src.source || '')}">${escapeHtml(name)}</div>
                ${excerpt ? `<div class="qp-source-excerpt">${escapeHtml(excerpt)}</div>` : ''}
            </div>
        `;
        list.appendChild(item);
    });

    section.style.display = 'block';
}

// ── Key Metrics Extraction ────────────────────────────────────
function showKeyMetrics(text) {
    const cells = $('metricsCells');
    if (!cells) return;

    // Extract dollar amounts
    const dollarMatches = [...text.matchAll(/\$[\d,]+(?:\.\d{2})?(?:[kKMB]|\s*(?:million|billion|thousand))?/g)];
    // Extract percentages
    const pctMatches = [...text.matchAll(/\b(\d+(?:\.\d+)?)\s*%/g)];

    const metrics = [];

    // Take top dollar amounts (unique, descending)
    const dollars = [...new Set(dollarMatches.map(m => m[0]))].slice(0, 2);
    dollars.forEach((d, i) => {
        // Try to extract context (word before the dollar amount)
        const idx  = text.indexOf(d);
        const pre  = text.slice(Math.max(0, idx - 30), idx).trim();
        const words = pre.split(/\s+/);
        const label = words.slice(-2).join(' ').replace(/[^a-zA-Z\s]/g, '').trim() || `Finding ${i + 1}`;
        metrics.push({ label: label || `Impact ${i + 1}`, value: d });
    });

    // Take top percentages
    const pcts = [...new Set(pctMatches.map(m => m[0]))].slice(0, 2 - metrics.length);
    pcts.forEach((p, i) => {
        const idx  = text.indexOf(p);
        const pre  = text.slice(Math.max(0, idx - 30), idx).trim();
        const words = pre.split(/\s+/);
        const label = words.slice(-2).join(' ').replace(/[^a-zA-Z\s]/g, '').trim() || `Variance ${i + 1}`;
        metrics.push({ label: label || `Variance ${i + 1}`, value: p + '%' });
    });

    if (metrics.length === 0) return;

    cells.innerHTML = metrics.map(m => `
        <div class="qp-metric-cell">
            <div class="qp-metric-label">${escapeHtml(m.label.slice(0, 28))}</div>
            <div class="qp-metric-value">${escapeHtml(m.value)}</div>
        </div>
    `).join('');

    $('metricsGrid').style.display = 'block';
}

// ── Action Buttons ────────────────────────────────────────────
function initActionButtons() {
    // Save as Pattern
    const saveBtn = $('savePatternBtn');
    if (saveBtn) saveBtn.addEventListener('click', () => {
        const query = $('queryInput').value.trim();
        if (!query) { showToast('Type a query first to save as a pattern.', 'error'); return; }
        $('patternQueryPreview').textContent = query.slice(0, 80) + (query.length > 80 ? '…' : '');
        $('patternName').value = '';
        $('savePatternModal').style.display = 'flex';
        setTimeout(() => $('patternName').focus(), 50);
    });

    // Save Pattern modal controls
    $('savePatternModalClose')?.addEventListener('click', () => { $('savePatternModal').style.display = 'none'; });
    $('savePatternModalBackdrop')?.addEventListener('click', () => { $('savePatternModal').style.display = 'none'; });
    $('savePatternCancelBtn')?.addEventListener('click', () => { $('savePatternModal').style.display = 'none'; });
    $('savePatternConfirmBtn')?.addEventListener('click', () => {
        const name  = $('patternName').value.trim();
        const query = $('queryInput').value.trim();
        if (!name)  { showToast('Please enter a pattern name.', 'error'); return; }
        const confirmBtn = $('savePatternConfirmBtn');
        confirmBtn.disabled    = true;
        confirmBtn.textContent = '✓ Saved!';
        savePatternLocally(name, query);
        showToast(`Pattern "${name}" saved to session library.`, 'success');
        setTimeout(() => {
            $('savePatternModal').style.display = 'none';
            confirmBtn.disabled    = false;
            confirmBtn.textContent = 'Save Pattern';
        }, 900);
    });

    // Refine
    const refineBtn = $('refineBtn');
    if (refineBtn) refineBtn.addEventListener('click', () => {
        if (!lastResponseText) { showToast('Run a query first.', 'error'); return; }
        const refineQuery = `Please refine and improve the following response to make it more specific, actionable, and precise. Add concrete dollar amounts or percentages where possible:\n\n${lastResponseText.slice(0, 400)}`;
        $('queryInput').value = refineQuery;
        updateCharCount();
        runQuery();
    });

    // Send to Navigator
    const atlasBtn = $('sendAtlasBtn');
    if (atlasBtn) atlasBtn.addEventListener('click', () => {
        if (!lastResponseText) { showToast('Run a query first.', 'error'); return; }
        // Inject the response as context into the agent chat
        appendAgentMsg('ai', `📊 Main query response loaded as context:\n\n${lastResponseText.slice(0, 500)}${lastResponseText.length > 500 ? '…' : ''}`);
        agentHistory.push({ role: 'assistant', content: lastResponseText });
        showToast('Response sent to AI Navigator. Ask a follow-up question!', 'success');
        // Scroll agent to bottom
        const msgs = $('agentMessages');
        msgs.scrollTop = msgs.scrollHeight;
    });

    // Flag for Review
    const flagBtn = $('flagBtn');
    if (flagBtn) flagBtn.addEventListener('click', () => {
        if (!lastResponseText) { showToast('Run a query first.', 'error'); return; }
        $('flagText').value = '';
        $('flagModal').style.display = 'flex';
        setTimeout(() => $('flagText').focus(), 50);
        // Briefly highlight the flag button to confirm it was clicked
        flagBtn.style.background = 'rgba(239,68,68,0.2)';
        setTimeout(() => { flagBtn.style.background = ''; }, 600);
    });

    // Flag modal controls
    $('flagModalClose')?.addEventListener('click', () => { $('flagModal').style.display = 'none'; });
    $('flagModalBackdrop')?.addEventListener('click', () => { $('flagModal').style.display = 'none'; });
    $('flagCancelBtn')?.addEventListener('click', () => { $('flagModal').style.display = 'none'; });
    $('flagSubmitBtn')?.addEventListener('click', submitFlag);
}

async function submitFlag() {
    const correction = $('flagText').value.trim();
    if (!correction) { showToast('Please describe what was wrong.', 'error'); return; }

    $('flagSubmitBtn').disabled = true;
    $('flagSubmitBtn').textContent = 'Submitting…';

    try {
        const payload = {
            original_query:    lastQueryText,
            original_response: lastResponseText.slice(0, 800),
            correction_text:   correction,
            namespace:         activeNamespace,
        };

        const resp = await fetch('/api/chat/correction', {
            method:  'POST',
            headers: API_HEADERS,
            body:    JSON.stringify(payload),
        });

        const data = await resp.json();
        $('flagModal').style.display = 'none';

        if (resp.ok) {
            showToast(`Correction logged as ${data.adr_id}. Bryan has been notified.`, 'success');
        } else {
            showToast(`Failed to log correction: ${data.detail || 'Unknown error'}`, 'error');
        }
    } catch (err) {
        showToast(`Error: ${err.message}`, 'error');
    } finally {
        $('flagSubmitBtn').disabled = false;
        $('flagSubmitBtn').textContent = 'Submit Correction';
    }
}

function savePatternLocally(name, query) {
    try {
        const stored = JSON.parse(localStorage.getItem('qp_patterns') || '[]');
        stored.push({ name, query, ns: activeNamespace, ts: Date.now() });
        localStorage.setItem('qp_patterns', JSON.stringify(stored.slice(-20)));
    } catch (e) { /* ignore */ }
}

// ── Suggested Actions ─────────────────────────────────────────
function initSuggestedActions() {
    $$('.qp-sa-btn').forEach(btn => {
        if (btn.id === 'newSessionBtn') {
            btn.addEventListener('click', () => {
                const msgs = $('agentMessages');
                while (msgs.children.length > 1) msgs.removeChild(msgs.lastChild);
                agentHistory.length = 0;
                lastResponseText    = '';
                lastQueryText       = '';
                $('queryInput').value = '';
                updateCharCount();
                resetResponse();
                showToast('New session started. Knowledge base still loaded.', 'success');
            });
            return;
        }

        btn.addEventListener('click', () => {
            const action = btn.dataset.action;
            if (!action) return;
            $('queryInput').value = action;
            updateCharCount();
            // Flash the query textarea
            $('queryInput').style.boxShadow = '0 0 0 3px rgba(59,130,246,0.4)';
            setTimeout(() => { $('queryInput').style.boxShadow = ''; }, 800);
            runQuery();
        });
    });
}

// ── Partner Bar ───────────────────────────────────────────────
function initPartnerBar() {
    // Nothing needed — collapse handled by global functions below
}

// ── KB Status Panel ───────────────────────────────────────────
async function loadKBStatus() {
    const el = $('kbStatusList');
    if (!el) return;
    try {
        const r  = await fetch('/api/ingest/stats', { headers: API_HEADERS });
        const d  = await r.json();
        const ns = d.namespaces || {};

        // Cache chunk counts for domain guidance + selector labels
        Object.entries(ns).forEach(([key, v]) => { _nsChunkCounts[key] = v.vectors || 0; });

        // Auto-switch: if current domain is empty but another known domain has content,
        // pick the best available namespace so users see data immediately
        if ((_nsChunkCounts[activeNamespace] || 0) === 0) {
            const preferred = ['documents', 'structured_data', 'compliance', 'audio', 'web', 'base'];
            const best = preferred.find(ns_key => (_nsChunkCounts[ns_key] || 0) > 0);
            if (best) {
                const sel = $('domainSelect');
                if (sel) {
                    sel.value = best;
                    const opt = sel.options[sel.selectedIndex];
                    activeNamespace = best;
                    activeLabel     = opt?.getAttribute('data-label') || best;
                    $('activeDomainLabel') && ($('activeDomainLabel').textContent = activeLabel);
                    $('agentDomainName')   && ($('agentDomainName').textContent   = activeLabel);
                    $('modalDomainName')   && ($('modalDomainName').textContent   = activeLabel);
                }
            }
        }

        // Update domain selector options with live counts
        _updateDomainCounts(ns);

        // Refresh guidance for currently active domain (may now have data)
        _showDomainGuidance(activeNamespace);

        const active = Object.entries(ns).filter(([, v]) => v.vectors > 0);
        if (active.length === 0) {
            el.innerHTML = '<span class="qp-kb-status-item" style="opacity:.5">No data loaded yet &ensp;<a href="/" style="color:var(--qp-accent,#38bdf8);text-decoration:none">&#8592; Upload on Dashboard</a></span>';
        } else {
            el.innerHTML = active.map(([name, v]) =>
                `<span class="qp-kb-status-item">
                    ${name}<span class="qp-kb-status-count">&nbsp;·&nbsp;${v.vectors.toLocaleString()} chunks</span>
                </span>`
            ).join('');
        }
    } catch {
        el.innerHTML = '<span class="qp-kb-status-item" style="opacity:.5">KB unavailable</span>';
    }
}

// ── Pattern Search Filter ─────────────────────────────────────
function filterPatterns(query) {
    const q = query.trim().toLowerCase();
    $$('.qp-pattern-btn').forEach(btn => {
        const name = btn.querySelector('.qp-pattern-name')?.textContent.toLowerCase() || '';
        const desc = btn.querySelector('.qp-pattern-desc')?.textContent.toLowerCase() || '';
        const match = !q || name.includes(q) || desc.includes(q);
        btn.classList.toggle('qp-hidden', !match);
    });
    // While searching: expand all categories so matched patterns are visible
    if (q) {
        $$('.qp-category-patterns').forEach(p => { p.style.display = 'flex'; });
        $$('.qp-category-chevron').forEach(c => { c.classList.remove('rotated'); });
    } else {
        // On clear: restore all categories to default expanded state
        $$('.qp-category-patterns').forEach(p => { p.style.display = 'flex'; });
        $$('.qp-category-chevron').forEach(c => { c.classList.remove('rotated'); });
    }
}

// ── Navigator Tab Switching ───────────────────────────────────
function setNavTab(btn, mode) {
    $$('.qp-nav-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    // Update agent placeholder text based on mode
    const placeholders = {
        explore:  'Ask a question about your data\u2026',
        analyst:  'Request a deep financial analysis\u2026',
        execute:  'What action should I take on these findings\u2026',
        govern:   'Check compliance or governance implications\u2026',
    };
    const input = $('agentInput');
    if (input) input.placeholder = placeholders[mode] || placeholders.explore;
}

// ── New Pattern from Sidebar ──────────────────────────────────
function showNewPatternFromSidebar() {
    const query = $('queryInput')?.value?.trim();
    if (query) {
        $('patternQueryPreview').textContent = query.slice(0, 60) + (query.length > 60 ? '\u2026' : '');
        $('savePatternModal').style.display = 'flex';
    } else {
        $('queryInput')?.focus();
        showToast('Type a query first, then save it as a pattern', 'info');
    }
}

// ── Convert from Chat ─────────────────────────────────────────
function convertFromChat() {
    const lastMsg = agentHistory.filter(m => m.role === 'user').slice(-1)[0];
    if (lastMsg?.content) {
        $('queryInput').value = lastMsg.content;
        updateCharCount();
        showToast('Last Navigator query loaded into Query Builder', 'success');
    } else {
        showToast('No Navigator conversation to convert yet', 'info');
    }
}

function togglePartnerBar() {
    const bar    = $('partnerBar');
    const layout = $('qpLayout');
    const btn    = $('partnerCollapseBtn');

    partnerBarOpen = !partnerBarOpen;
    bar.classList.toggle('collapsed', !partnerBarOpen);
    layout.classList.toggle('partner-collapsed', !partnerBarOpen);
    btn.textContent = partnerBarOpen ? '▲' : '▼';
    btn.title       = partnerBarOpen ? 'Collapse' : 'Expand';
}

function requestPartnerPhoto() {
    showToast('📷 Reminder: Ask Josh Williams (josh@fedshark.com) to share a headshot photo for the demo panel.', 'success');
}

// ── Copy Button ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const copyBtn = $('copyBtn');
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            const text = $('responseText').innerText;
            navigator.clipboard.writeText(text).then(() => {
                copyBtn.textContent = '✓ Copied';
                setTimeout(() => { copyBtn.innerHTML = '📋 Copy'; }, 1800);
            });
        });
    }
});

// ── Knowledge Agent ───────────────────────────────────────────
function initAgent() {
    const input  = $('agentInput');
    const send   = $('agentSend');
    const clrBtn = $('agentClear');

    if (send)   send.addEventListener('click', sendAgentMessage);
    if (input)  input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendAgentMessage();
        }
    });

    if (clrBtn) {
        clrBtn.addEventListener('click', () => {
            const msgs = $('agentMessages');
            while (msgs.children.length > 1) msgs.removeChild(msgs.lastChild);
            agentHistory.length = 0;
        });
    }
}

async function sendAgentMessage() {
    if (agentBusy) return;
    const input = $('agentInput');
    const msg   = input.value.trim();
    if (!msg) return;

    agentBusy = true;
    input.value = '';
    $('agentSend').disabled = true;

    appendAgentMsg('user', msg);
    agentHistory.push({ role: 'user', content: msg });

    const typingId = 'agent-typing-' + Date.now();
    const typingEl = appendAgentMsg('ai', '…', typingId);

    try {
        const payload = {
            query:     msg,
            namespace: activeNamespace,
            top_k:     6,
            stream:    true,
        };

        const resp = await fetch('/api/chat', {
            method:  'POST',
            headers: API_HEADERS,
            body:    JSON.stringify(payload),
        });

        if (!resp.ok) {
            const errData = await resp.json().catch(() => ({ detail: resp.statusText }));
            throw new Error(errData.detail || `HTTP ${resp.status}`);
        }

        // Stream tokens into the typing element (falls back to plain JSON if server doesn't SSE)
        const reader  = resp.body.getReader();
        const decoder = new TextDecoder();
        let full    = '';
        let rawBody = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            rawBody += chunk;
            for (const line of chunk.split('\n')) {
                if (!line.startsWith('data: ')) continue;
                const raw = line.slice(6).trim();
                if (raw === '[DONE]') continue;
                try {
                    const obj = JSON.parse(raw);
                    if (obj.token)    { full += obj.token; }
                    if (obj.response) { full = obj.response; }
                } catch { /* partial chunk */ }
            }
            if (typingEl && full) renderMarkdown(typingEl, full);
            scrollAgentToBottom();
        }

        // Fallback: parse plain JSON body when server doesn't return SSE
        if (!full && rawBody.trim().startsWith('{')) {
            try {
                const data = JSON.parse(rawBody);
                full = data.response || data.answer || '';
            } catch { /* leave empty */ }
        }

        const answer = full || 'No response from knowledge base.';
        if (typingEl) renderMarkdown(typingEl, answer);
        agentHistory.push({ role: 'assistant', content: answer });

    } catch (err) {
        if (typingEl) typingEl.textContent = `Error: ${err.message}`;
    } finally {
        agentBusy = false;
        $('agentSend').disabled = false;
        input.focus();
        scrollAgentToBottom();
    }
}

function appendAgentMsg(role, text, id) {
    const msgs = $('agentMessages');
    const wrap = document.createElement('div');
    wrap.className = `qp-agent-msg qp-agent-${role}`;

    const icon = document.createElement('span');
    icon.className = 'qp-agent-msg-icon';
    icon.textContent = role === 'user' ? '👤' : '✦';

    const body = document.createElement('div');
    body.className = 'qp-agent-msg-body';
    body.textContent = text;
    if (id) body.id = id;

    wrap.appendChild(icon);
    wrap.appendChild(body);
    msgs.appendChild(wrap);
    scrollAgentToBottom();
    return body;
}

function scrollAgentToBottom() {
    const msgs = $('agentMessages');
    msgs.scrollTop = msgs.scrollHeight;
}

// ── ADR Toggle ────────────────────────────────────────────────
function initADR() {
    const toggle  = $('adrToggle');
    const details = $('adrDetails');
    if (!toggle || !details) return;

    toggle.addEventListener('click', () => {
        const hidden = details.style.display === 'none';
        details.style.display = hidden ? 'block' : 'none';
        toggle.textContent    = hidden ? 'Hide Details' : 'Show Details';
    });
}

// ── Upload / Ingest ───────────────────────────────────────────
function initUpload() {
    $('modalBackdrop')?.addEventListener('click', closeModal);
    $('modalClose')?.addEventListener('click',    closeModal);

    $('modalFileInput')?.addEventListener('change', e => {
        handleFiles(Array.from(e.target.files));
    });

    const modalDrop = $('modalDrop');
    if (modalDrop) {
        modalDrop.addEventListener('dragover', e => {
            e.preventDefault();
            modalDrop.style.borderColor = 'rgba(59,130,246,0.7)';
        });
        modalDrop.addEventListener('dragleave', () => {
            modalDrop.style.borderColor = '';
        });
        modalDrop.addEventListener('drop', e => {
            e.preventDefault();
            modalDrop.style.borderColor = '';
            handleFiles(Array.from(e.dataTransfer.files));
        });
    }

    $('urlIngestBtn')?.addEventListener('click', ingestUrl);
    $('urlInput')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') ingestUrl();
    });
}

function closeModal() {
    $('uploadModal').style.display = 'none';
}

async function handleFiles(files) {
    if (!files.length) return;
    const progress = $('modalProgress');
    const fill     = $('modalProgressFill');
    const status   = $('modalStatus');

    progress.style.display = 'block';

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        status.textContent = `Uploading ${i + 1}/${files.length}: ${file.name}…`;
        fill.style.width   = `${((i + 1) / files.length) * 100}%`;

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('namespace', activeNamespace);

            const r = await fetch('/api/ingest/file', {
                method:  'POST',
                headers: { 'Authorization': `Basic ${AUTH}` },
                body:    formData,
            });

            const d = await r.json();
            if (r.ok) {
                const n = d.chunks_total || d.chunks_stored || '?';
                status.textContent = `✓ ${file.name} — ${n} chunks indexed`;
            } else {
                status.textContent = `✗ ${file.name}: ${d.detail || d.message || 'Upload failed'}`;
            }
        } catch (err) {
            status.textContent = `✗ ${file.name}: ${err.message}`;
        }

        await sleep(300);
    }

    fill.style.width = '100%';
    status.textContent += ' — Done! Run a query to explore your data.';
    // Refresh KB status panel so partner bar shows new chunk counts
    setTimeout(loadKBStatus, 800);
    // Give users 4s to read status before auto-close (was 2.5s — too fast for multi-file)
    setTimeout(closeModal, 4000);
}

async function ingestUrl() {
    const url = $('urlInput').value.trim();
    if (!url) return;

    const progress = $('modalProgress');
    const fill     = $('modalProgressFill');
    const status   = $('modalStatus');

    progress.style.display = 'block';
    fill.style.width = '33%';
    status.textContent = 'Fetching URL…';

    try {
        const r = await fetch('/api/ingest/url', {
            method:  'POST',
            headers: API_HEADERS,
            body:    JSON.stringify({ url, namespace: activeNamespace }),
        });

        fill.style.width = '66%';
        const d = await r.json();

        if (r.ok) {
            fill.style.width = '100%';
            status.textContent = `✓ Ingested: ${d.chunks_stored || '?'} chunks from ${url}`;
            $('urlInput').value = '';
            setTimeout(closeModal, 2000);
        } else {
            status.textContent = `✗ ${d.detail || 'Ingest failed'}`;
        }
    } catch (err) {
        status.textContent = `✗ Error: ${err.message}`;
    }
}

// ── Markdown Renderer ─────────────────────────────────────────
function renderMarkdown(el, text) {
    let html = escapeHtml(text)
        .replace(/^### (.+)$/gm,    '<h3>$1</h3>')
        .replace(/^## (.+)$/gm,     '<h2>$1</h2>')
        .replace(/^# (.+)$/gm,      '<h1>$1</h1>')
        .replace(/\*\*(.+?)\*\*/g,  '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g,      '<em>$1</em>')
        .replace(/`([^`]+)`/g,      '<code>$1</code>')
        .replace(/^---$/gm,         '<hr>')
        .replace(/^[\*\-] (.+)$/gm, '<li>$1</li>')
        .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
        .replace(/^\d+\. (.+)$/gm,  '<li>$1</li>')
        .replace(/^&gt; (.+)$/gm,   '<blockquote>$1</blockquote>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>');

    el.innerHTML = `<p>${html}</p>`;
}

function highlightDollars(el) {
    el.innerHTML = el.innerHTML.replace(
        /(\$[\d,]+(?:\.\d{2})?(?:k|K|M|B)?(?:\s*(?:million|billion|thousand))?)/g,
        '<span class="qp-dollar">$1</span>'
    );
}

function showComplianceBadges(frameworks) {
    const container = $('complianceBadges');
    container.innerHTML = frameworks
        .map(f => `<span class="qp-compliance-badge">${escapeHtml(f)}</span>`)
        .join('');
}

// ── Status (unused alias, kept for compatibility) ─────────────
function initStatus() { /* status handled in checkHealth */ }

// ── Toast ─────────────────────────────────────────────────────
function showToast(msg, type) {
    const toast = $('qpToast');
    if (!toast) return;
    toast.textContent = msg;
    toast.className = `qp-toast${type ? ' ' + type : ''}`;
    toast.style.display = 'block';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => { toast.style.display = 'none'; }, 4000);
}

// ── Utilities ─────────────────────────────────────────────────
function escapeHtml(str) {
    return String(str)
        .replace(/&/g,  '&amp;')
        .replace(/</g,  '&lt;')
        .replace(/>/g,  '&gt;')
        .replace(/"/g,  '&quot;')
        .replace(/'/g,  '&#039;');
}

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}
