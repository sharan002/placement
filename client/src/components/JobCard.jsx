export default function JobCard({ job }) {
  const company = job.companyName || 'Company not listed'
  const location =
    job.location?.formattedAddressShort ||
    job.location?.fullAddress ||
    'Location N/A'
  const posted = job.postedToday ? 'Today' : (job.age || job.datePublished || '')
  const topSkills = (job.attributes || []).slice(0, 6)
  const desc = job.descriptionText
    ? job.descriptionText.replace(/\n+/g, ' ').slice(0, 200).trim() + '…'
    : ''

  return (
    <div className="job-card">
      <div className="card-top">
        <div className="company-name">{company}</div>
        <div className={`posted-badge${job.postedToday ? ' today' : ''}`}>
          {job.postedToday ? '🟢 ' : '🕐 '}{posted}
        </div>
      </div>

      <h3 className="job-title">{job.title || 'Untitled Position'}</h3>

      <div className="job-meta">
        <span>📍 {location}</span>
        {job.isRemote && <span className="remote-badge">Remote</span>}
      </div>

      {job.salary?.salaryText && (
        <div className="salary">💰 {job.salary.salaryText}</div>
      )}

      {(job.jobType || []).length > 0 && (
        <div className="job-types">
          {job.jobType.map((t, i) => (
            <span key={i} className="type-badge">{t}</span>
          ))}
        </div>
      )}

      {topSkills.length > 0 && (
        <div className="skills">
          {topSkills.map((s, i) => (
            <span key={i} className="skill-tag">{s}</span>
          ))}
        </div>
      )}

      {desc && <p className="description">{desc}</p>}

      <div className="card-actions">
        <a
          href={job.applyUrl || job.jobUrl || '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-apply"
        >
          Apply Now →
        </a>
        <a
          href={job.jobUrl || '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-view"
        >
          Details
        </a>
      </div>
    </div>
  )
}
