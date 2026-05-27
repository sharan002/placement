export default function FilterBar({ filters, onChange, onSearch }) {
  return (
    <section className="filters">
      <div className="filter-row">
        <div className="filter-item">
          <label>Posted within</label>
          <select value={filters.fromDays} onChange={e => onChange('fromDays', e.target.value)}>
            <option value="1">Today</option>
            <option value="3">Last 3 days</option>
            <option value="7">Last 7 days</option>
            <option value="14">Last 14 days</option>
            <option value="30">Last 30 days</option>
          </select>
        </div>

        <div className="filter-item">
          <label>Job Type</label>
          <select value={filters.jobType} onChange={e => onChange('jobType', e.target.value)}>
            <option value="">All Types</option>
            <option value="fulltime">Full-time</option>
            <option value="parttime">Part-time</option>
            <option value="contract">Contract</option>
            <option value="internship">Internship / Fresher</option>
          </select>
        </div>

        <div className="filter-item">
          <label>Location (pre-fetched)</label>
          <input
            type="text"
            value="Coimbatore"
            readOnly
            style={{ cursor: 'default', opacity: 0.7 }}
          />
        </div>

        <button className="btn-search" onClick={onSearch}>Search Jobs</button>
      </div>
    </section>
  )
}
