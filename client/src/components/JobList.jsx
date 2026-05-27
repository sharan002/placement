import JobCard from './JobCard'

function Skeleton() {
  return (
    <div className="skeleton">
      <div className="skel-line short"></div>
      <div className="skel-line title"></div>
      <div className="skel-line medium"></div>
      <div className="skel-line short"></div>
      <div className="skel-line full"></div>
      <div className="skel-line full"></div>
      <div className="skel-line medium"></div>
    </div>
  )
}

export default function JobList({ jobs, loading, error }) {
  if (loading) {
    return (
      <div id="jobs-grid">
        {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} />)}
      </div>
    )
  }

  if (error) {
    return (
      <div id="jobs-grid">
        <div className="state-message error">
          <h3>Failed to load jobs</h3>
          <p>{error}</p>
        </div>
      </div>
    )
  }

  if (jobs.length === 0) {
    return (
      <div id="jobs-grid">
        <div className="state-message">
          <h3>No jobs found</h3>
          <p>Try a wider date range or check back after the daily refresh at 9 AM.</p>
        </div>
      </div>
    )
  }

  return (
    <div id="jobs-grid">
      {jobs.map((job, i) => <JobCard key={job._id || i} job={job} />)}
    </div>
  )
}
