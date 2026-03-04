/**
 * Table of Contents — Auto-Discovery App
 * 
 * On every page load:
 *   1. Fetches all public repos from georgetaylor3978
 *   2. Filters to repos with GitHub Pages enabled
 *   3. Groups by "category-*" topic (set in repo Settings → Topics)
 *   4. Renders a card grid, sorted alphabetically
 *
 * To add a new dashboard: just deploy it to GitHub Pages.
 * To categorize: add a topic like "category-fiscal-policy" in the repo settings.
 * To describe:   edit the repo's About/Description on GitHub.
 */

const GITHUB_USER = 'georgetaylor3978';
const SELF_REPO = 'Table-of-Contents';   // exclude ourselves

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
function renderDashboards(repos) {
    // Filter: has_pages && not self
    const dashboards = repos.filter(r => r.has_pages && r.name !== SELF_REPO);

    if (dashboards.length === 0) {
        $container.innerHTML = '<p style="text-align:center;color:#94a3b8;padding:40px 0;">No dashboards found with GitHub Pages enabled.</p>';
        $container.style.display = '';
        return;
    }

    // Group by category
    const groups = {};
    for (const d of dashboards) {
        const cat = extractCategory(d.topics || []) || 'Other';
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(d);
    }

    // Sort categories (put "Other" last)
    const sortedCats = Object.keys(groups).sort((a, b) => {
        if (a === 'Other') return 1;
        if (b === 'Other') return -1;
        return a.localeCompare(b);
    });

    // Sort repos within each category
    for (const cat of sortedCats) {
        groups[cat].sort((a, b) => friendlyName(a.name).localeCompare(friendlyName(b.name)));
    }

    let html = '';
    for (const cat of sortedCats) {
        const items = groups[cat];
        html += `
        <section class="category-section">
            <h2 class="category-heading">
                ${cat}
                <span class="cat-count">${items.length}</span>
            </h2>
            <div class="dashboard-grid">
                ${items.map(cardHTML).join('')}
            </div>
        </section>`;
    }

    $container.innerHTML = html;
    $container.style.display = '';
}

function cardHTML(repo) {
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
            <a class="btn-secondary" href="${repoUrl(repo.name)}" target="_blank" rel="noopener noreferrer">
                Source
            </a>
        </div>
    </article>`;
}

// ── Load ──
async function loadDashboards() {
    try {
        const res = await fetch(
            `https://api.github.com/users/${GITHUB_USER}/repos?per_page=100&sort=updated`,
            { headers: { Accept: 'application/vnd.github.mercy-preview+json' } }
        );

        if (!res.ok) {
            const remaining = res.headers.get('X-RateLimit-Remaining');
            if (remaining === '0') throw new Error('GitHub API rate limit reached. Try again in a few minutes.');
            throw new Error(`GitHub API returned ${res.status}`);
        }

        const repos = await res.json();

        $loading.style.display = 'none';
        $status.classList.add('loaded');
        $statusText.textContent = `${repos.filter(r => r.has_pages && r.name !== SELF_REPO).length} dashboards`;

        renderDashboards(repos);

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
