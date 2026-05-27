import { useState, useEffect, useCallback } from 'react'
import Header from './components/Header'
import TabBar from './components/TabBar'
import FilterBar from './components/FilterBar'
import JobList from './components/JobList'

const CATEGORY_LABELS = {
  python: 'Python',
  java: 'Java Full Stack',
  mern: 'MERN Stack',
}

export default function App() {
  const [category, setCategory] = useState('python')
  const [filters, setFilters] = useState({ fromDays: '7', jobType: '' })
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchJobs = useCallback(async () => {
    setLoading(true)
    setError(null)

    const params = new URLSearchParams({ fromDays: filters.fromDays, maxItems: 20 })
    if (filters.jobType) params.set('jobType', filters.jobType)

    try {
      const res = await fetch(`/api/jobs/${category}?${params}`)
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.details || data.error || 'Unknown error')
      setJobs(data.jobs || [])
    } catch (err) {
      setError(err.message)
      setJobs([])
    } finally {
      setLoading(false)
    }
  }, [category, filters])

  useEffect(() => { fetchJobs() }, [fetchJobs])

  const handleCategoryChange = (cat) => {
    setCategory(cat)
  }

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  return (
    <>
      <Header />
      <TabBar category={category} onCategoryChange={handleCategoryChange} />
      <FilterBar filters={filters} onChange={handleFilterChange} onSearch={fetchJobs} />
      <main>
        <div id="result-info">
          {!loading && !error && jobs.length > 0 &&
            `Showing ${jobs.length} ${CATEGORY_LABELS[category]} jobs · Updated daily at 9 AM`}
        </div>
        <JobList jobs={jobs} loading={loading} error={error} />
      </main>
    </>
  )
}
