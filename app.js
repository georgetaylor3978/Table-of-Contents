/**
 * Table of Contents — Auto-Discovery App
 * 
 * On every page load:
 *   1. Fetches all public repos from georgetaylor3978
 *   2. Fetches external links from the Table-links repo (links.json)
 *   3. Filters repos with GitHub Pages enabled
 *   4. Groups by "category-*" topic (set in repo Settings → Topics)
 *   5. "Other" category only appears on the hidden tab
 *   6. External links are rendered as link-cards with amber accent
 *   7. Hidden tab requires password ("mellon") via wizard modal
 *   8. Authenticated state is cached in localStorage
 *
 * To add a new dashboard: just deploy it to GitHub Pages.
 * To categorize: add a topic like "category-fiscal-policy" in the repo settings.
 * To describe:   edit the repo's About/Description on GitHub.
 */

const GITHUB_USER = 'georgetaylor3978';
const SELF_REPO = 'Table-of-Contents';   // exclude ourselves
const LINKS_REPO = 'Table-links';        // exclude from dashboard cards
const LINKS_JSON_URL = `https://raw.githubusercontent.com/${GITHUB_USER}/Table-links/main/links.json`;
const AUTH_KEY = 'wizardAuth';
const MAGIC_WORD = 'mellon';

// ── Friendly name map (override auto-generated names) ──
const FRIENDLY_NAMES = {
    '10Yr-Canada-Financials': '10-Year Canada Financials',
    'TransferPayments': 'Transfer Payments',
    'Child-Benefit-Canada-': 'Child Benefits — Canada',
    'canada-expgroup': 'Federal Expenses by Group',
    'canada-federal-exp-paytype': 'Federal Expenses by Pay Type',
    'FundsAdvancedBanksCanada': 'Funds Advanced to Banks — Canada',
    'crea-hpi-dashboard': 'CREA Housing Price Index',
};

// ── State ──
let currentTab = 'main'; // 'main' or 'hidden'
let allGithubRepos = [];
let allExternalLinks = [];
let isAuthenticated = localStorage.getItem(AUTH_KEY) === 'true';

// ── DOM refs ──
const $status = document.getElementById('dataStatus');
const $statusText = document.getElementById('statusText');
const $loading = document.getElementById('loadingState');
const $error = document.getElementById('errorState');
const $errorMsg = document.getElementById('errorMessage');
const $container = document.getElementById('dashboardContainer');
const $retryBtn = document.getElementById('retryBtn');
const $howToToggle = document.getElementById('howToToggle');
const $howToDetails = document.getElementById('howToDetails');
const $wizardBtn = document.getElementById('wizardBtn');
const $wizardImg = document.getElementById('wizardImg');
const $wizardModal = document.getElementById('wizardModal');
const $wizardInput = document.getElementById('wizardInput');
const $wizardSubmit = document.getElementById('wizardSubmit');
const $wizardPrompt = document.getElementById('wizardPrompt');

// ── How-to accordion ──
$howToToggle.addEventListener('click', () => {
    const open = $howToDetails.classList.toggle('open');
    $howToToggle.setAttribute('aria-expanded', open);
});

// ── Retry button ──
$retryBtn.addEventListener('click', () => {
    $error.style.display = 'none';
    $loading.style.display = '';
    loadDashboards();
});

// ── Wizard button ──
$wizardBtn.addEventListener('click', () => {
    if (currentTab === 'hidden') {
        // On hidden tab: clicking red wizard returns to main
        switchToMain();
    } else {
        // On main tab: check if already authenticated
        if (isAuthenticated) {
            switchToHidden();
        } else {
            openWizardModal();
        }
    }
});

// ── Wizard modal ──
function openWizardModal() {
    $wizardPrompt.textContent = 'Magic Word';
    $wizardPrompt.classList.remove('error');
    $wizardInput.value = '';
    $wizardModal.classList.add('active');
    setTimeout(() => $wizardInput.focus(), 100);
}

function closeWizardModal() {
    $wizardModal.classList.remove('active');
}

$wizardSubmit.addEventListener('click', attemptPassword);
$wizardInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') attemptPassword();
});

$wizardModal.addEventListener('click', (e) => {
    if (e.target === $wizardModal) closeWizardModal();
});

function attemptPassword() {
    const attempt = $wizardInput.value.trim().toLowerCase();
    if (attempt === MAGIC_WORD) {
        // Correct!
        isAuthenticated = true;
        localStorage.setItem(AUTH_KEY, 'true');
        closeWizardModal();
        switchToHidden();
    } else {
        // Wrong
        $wizardPrompt.textContent = 'You shall not pass';
        $wizardPrompt.classList.add('error');
        $wizardInput.value = '';
        setTimeout(() => closeWizardModal(), 1000);
    }
}

// ── Tab switching ──
function switchToHidden() {
    currentTab = 'hidden';
    $wizardImg.src = 'wizred.png';
    $wizardBtn.title = 'Return to main dashboard';
    renderAll();
}

function switchToMain() {
    currentTab = 'main';
    $wizardImg.src = 'wizgrey.png';
    $wizardBtn.title = 'Enter the hidden realm';
    renderAll();
}

// ── Helpers ──
function friendlyName(repoName) {
    if (FRIENDLY_NAMES[repoName]) return FRIENDLY_NAMES[repoName];
    // Auto-generate: replace dashes/underscores, title-case
    return repoName
        .replace(/[-_]+/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
}

function pagesUrl(repoName) {
    return `https://${GITHUB_USER}.github.io/${repoName}/`;
}

function repoUrl(repoName) {
    return `https://github.com/${GITHUB_USER}/${repoName}`;
}

function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (days > 30) return new Date(dateStr).toLocaleDateString('en-CA');
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    return `${mins}m ago`;
}

function extractCategory(topics) {
    for (const t of topics) {
        if (t.startsWith('category-')) {
            return t.slice(9).replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        }
    }
    return null;
}

// ── Render ──
function renderAll() {
    renderDashboards(allGithubRepos, allExternalLinks);
}

function renderDashboards(repos, externalLinks) {
    // Filter: has_pages && not self && not links repo
    const dashboards = repos.filter(r => r.has_pages && r.name !== SELF_REPO && r.name !== LINKS_REPO);

    // Group GitHub repos by category
    const groups = {};
    for (const d of dashboards) {
        const cat = extractCategory(d.topics || []) || 'Other';
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push({ type: 'github', data: d });
    }

    // Group external links by category
    for (const link of externalLinks) {
        const cat = link.category || 'Other';
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push({ type: 'link', data: link });
    }

    // Determine which categories to show based on current tab
    let visibleGroups = {};
    if (currentTab === 'main') {
        // Show everything EXCEPT "Other"
        for (const [cat, items] of Object.entries(groups)) {
            if (cat !== 'Other') visibleGroups[cat] = items;
        }
    } else {
        // Hidden tab: show ONLY "Other"
        if (groups['Other']) {
            visibleGroups['Other'] = groups['Other'];
        }
    }

    if (Object.keys(visibleGroups).length === 0) {
        const msg = currentTab === 'hidden'
            ? 'No items in the hidden realm… yet.'
            : 'No dashboards found with GitHub Pages enabled.';
        $container.innerHTML = `<p style="text-align:center;color:#94a3b8;padding:40px 0;">${msg}</p>`;
        $container.style.display = '';
        return;
    }

    // Sort categories alphabetically
    const sortedCats = Object.keys(visibleGroups).sort((a, b) => a.localeCompare(b));

    // Sort items within each category
    for (const cat of sortedCats) {
        visibleGroups[cat].sort((a, b) => {
            const nameA = a.type === 'github' ? friendlyName(a.data.name) : a.data.name;
            const nameB = b.type === 'github' ? friendlyName(b.data.name) : b.data.name;
            return nameA.localeCompare(nameB);
        });
    }

    let html = '';
    for (const cat of sortedCats) {
        const items = visibleGroups[cat];
        html += `
        <section class="category-section">
            <h2 class="category-heading">
                ${cat}
                <span class="cat-count">${items.length}</span>
            </h2>
            <div class="dashboard-grid">
                ${items.map(item => item.type === 'github' ? githubCardHTML(item.data) : linkCardHTML(item.data)).join('')}
            </div>
        </section>`;
    }

    $container.innerHTML = html;
    $container.style.display = '';
}

function githubCardHTML(repo) {
    const name = friendlyName(repo.name);
    const desc = repo.description || 'Interactive data dashboard';
    const lang = repo.language || 'Web';
    const ago = timeAgo(repo.pushed_at);
    const nonCatTopics = (repo.topics || []).filter(t => !t.startsWith('category-'));

    let topicsHTML = '';
    if (nonCatTopics.length) {
        topicsHTML = `<div class="card-topics">${nonCatTopics.map(t =>
            `<span class="topic-tag">${t}</span>`
        ).join('')}</div>`;
    }

    return `
    <article class="dash-card">
        <div class="card-title">
            <span class="live-dot"></span>
            ${name}
        </div>
        <div class="card-desc">${desc}</div>
        ${topicsHTML}
        <div class="card-meta">
            <span class="lang-badge">${lang}</span>
            <span>Updated ${ago}</span>
        </div>
        <div class="card-actions">
            <a class="btn-primary" href="${pagesUrl(repo.name)}" target="_blank" rel="noopener noreferrer">
                View Dashboard →
            </a>
        </div>
    </article>`;
}

function linkCardHTML(link) {
    return `
    <article class="dash-card link-card">
        <div class="card-title">
            <span class="live-dot"></span>
            ${link.name}
        </div>
        <div class="card-desc">${link.description || 'External link'}</div>
        <div class="card-meta">
            <span class="lang-badge link-badge">Link</span>
        </div>
        <div class="card-actions">
            <a class="btn-primary" href="${link.link}" target="_blank" rel="noopener noreferrer">
                Open Link →
            </a>
        </div>
    </article>`;
}

// ── Load ──
async function loadDashboards() {
    try {
        // Fetch GitHub repos and external links in parallel
        const [reposRes, linksRes] = await Promise.allSettled([
            fetch(
                `https://api.github.com/users/${GITHUB_USER}/repos?per_page=100&sort=updated`,
                { headers: { Accept: 'application/vnd.github.mercy-preview+json' } }
            ),
            fetch(LINKS_JSON_URL)
        ]);

        // Process GitHub repos
        if (reposRes.status === 'fulfilled' && reposRes.value.ok) {
            allGithubRepos = await reposRes.value.json();
        } else {
            const res = reposRes.status === 'fulfilled' ? reposRes.value : null;
            if (res) {
                const remaining = res.headers.get('X-RateLimit-Remaining');
                if (remaining === '0') throw new Error('GitHub API rate limit reached. Try again in a few minutes.');
                throw new Error(`GitHub API returned ${res.status}`);
            }
            throw new Error('Could not reach GitHub.');
        }

        // Process external links
        if (linksRes.status === 'fulfilled' && linksRes.value.ok) {
            allExternalLinks = await linksRes.value.json();
        } else {
            // Non-fatal: external links are supplementary
            console.warn('Could not load external links from Table-links repo.');
            allExternalLinks = [];
        }

        $loading.style.display = 'none';
        $status.classList.add('loaded');
        const dashCount = allGithubRepos.filter(r => r.has_pages && r.name !== SELF_REPO && r.name !== LINKS_REPO).length;
        const linkCount = allExternalLinks.length;
        $statusText.textContent = `${dashCount} dashboards · ${linkCount} links`;

        renderAll();

    } catch (err) {
        console.error('Failed to load repos:', err);
        $loading.style.display = 'none';
        $error.style.display = '';
        $errorMsg.textContent = err.message || 'Could not reach GitHub.';
        $status.classList.add('error');
        $statusText.textContent = 'Error';
    }
}

// ── Init ──
loadDashboards();
