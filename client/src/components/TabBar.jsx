const TABS = [
  { id: 'python', label: '🐍 Python' },
  { id: 'java',   label: '☕ Java' },
  { id: 'mern',   label: '⚡ MERN Stack' },
]

export default function TabBar({ category, onCategoryChange }) {
  return (
    <nav className="tabs">
      {TABS.map(tab => (
        <button
          key={tab.id}
          className={`tab${category === tab.id ? ' active' : ''}`}
          onClick={() => onCategoryChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  )
}
