const state = {
    category: 'python',
    fromDays: '3',
    jobType: '',
    location: 'Coimbatore',
};

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function renderSkeleton() {
    return Array.from({ length: 6 }, () => `
        <div class="skeleton">
            <div class="skel-line short"></div>
            <div class="skel-line title"></div>
            <div class="skel-line medium"></div>
            <div class="skel-line short"></div>
            <div class="skel-line full"></div>
            <div class="skel-line full"></div>
            <div class="skel-line medium"></div>
        </div>
    `).join('');
}

function renderCard(job) {
    const company  = job.companyName || 'Company not listed';
    const location = job.location?.formattedAddressShort
                  || job.location?.fullAddress
                  || 'Location N/A';
    const posted   = job.postedToday ? 'Today' : (job.age || job.datePublished || '');
    const topSkills = (job.attributes || []).slice(0, 6);
    const desc = job.descriptionText
        ? job.descriptionText.replace(/\n+/g, ' ').slice(0, 200).trim() + '…'
        : '';

    const typeBadges = (job.jobType || [])
        .map(t => `<span class="type-badge">${escapeHtml(t)}</span>`)
        .join('');

    const skillTags = topSkills
        .map(s => `<span class="skill-tag">${escapeHtml(s)}</span>`)
        .join('');

    return `
        <div class="job-card">
            <div class="card-top">
                <div class="company-name">${escapeHtml(company)}</div>
                <div class="posted-badge ${job.postedToday ? 'today' : ''}">
                    ${job.postedToday ? '🟢 ' : '🕐 '}${escapeHtml(posted)}
                </div>
            </div>

            <h3 class="job-title">${escapeHtml(job.title || 'Untitled Position')}</h3>

            <div class="job-meta">
                <span>📍 ${escapeHtml(location)}</span>
                ${job.isRemote ? '<span class="remote-badge">Remote</span>' : ''}
            </div>

            ${job.salary?.salaryText
                ? `<div class="salary">💰 ${escapeHtml(job.salary.salaryText)}</div>`
                : ''}

            ${typeBadges ? `<div class="job-types">${typeBadges}</div>` : ''}

            ${skillTags ? `<div class="skills">${skillTags}</div>` : ''}

            ${desc ? `<p class="description">${escapeHtml(desc)}</p>` : ''}

            <div class="card-actions">
                <a href="${escapeHtml(job.applyUrl || job.jobUrl || '#')}"
                   target="_blank" rel="noopener" class="btn-apply">Apply Now →</a>
                <a href="${escapeHtml(job.jobUrl || '#')}"
                   target="_blank" rel="noopener" class="btn-view">Details</a>
            </div>
        </div>
    `;
}

async function fetchJobs() {
    const grid = document.getElementById('jobs-grid');
    const info = document.getElementById('result-info');

    grid.innerHTML = renderSkeleton();
    info.textContent = 'Fetching live jobs from Indeed… this may take up to 60 seconds.';

    const params = new URLSearchParams({
        fromDays: state.fromDays,
        location: state.location,
        country: 'in',
        maxItems: 20,
    });
    if (state.jobType) params.set('jobType', state.jobType);

    try {
        const res  = await fetch(`/api/jobs/${state.category}?${params}`);
        const data = await res.json();

        if (!res.ok || !data.success) {
            throw new Error(data.details || data.error || 'Unknown error');
        }

        if (!data.jobs || data.jobs.length === 0) {
            grid.innerHTML = `
                <div class="state-message">
                    <h3>No jobs found</h3>
                    <p>Try a wider date range or a different location.</p>
                </div>`;
            info.textContent = '';
            return;
        }

        const label = { python: 'Python', java: 'Java Full Stack', mern: 'MERN Stack' };
        info.textContent = `Showing ${data.count} ${label[state.category]} jobs`;
        grid.innerHTML = data.jobs.map(renderCard).join('');

    } catch (err) {
        grid.innerHTML = `
            <div class="state-message error">
                <h3>Failed to load jobs</h3>
                <p>${escapeHtml(err.message)}</p>
            </div>`;
        info.textContent = '';
    }
}

// ── Event listeners ──────────────────────────────────────────────────────────

document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        state.category = tab.dataset.category;
        fetchJobs();
    });
});

document.getElementById('searchBtn').addEventListener('click', () => {
    state.fromDays = document.getElementById('fromDays').value;
    state.jobType  = document.getElementById('jobType').value;
    state.location = document.getElementById('location').value.trim() || 'Coimbatore';
    fetchJobs();
});

document.getElementById('location').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('searchBtn').click();
});

// ── Init ─────────────────────────────────────────────────────────────────────
fetchJobs();
