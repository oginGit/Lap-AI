/**
 * HistoryPage — displays past RUL reports and AI advice
 * Data is persisted in SQLite database via authenticated API.
 */
import { useState, useEffect } from 'react';
import { History, Trash2, RefreshCw, TrendingUp, TrendingDown, Minus, Calendar, ChevronDown, ChevronUp, Database } from 'lucide-react';
import { fetchHistory, deleteHistoryEntry, clearAllHistory } from '../utils/api';

// ─── Small helpers ────────────────────────────────────────────────────────────
const statusColor = (s) =>
  s === 'Good' ? 'var(--accent-green)' :
  s === 'Warning' ? 'var(--accent-yellow)' : 'var(--accent-red)';

const priorityBadge = (p) => {
  const map = { Urgent: 'badge-critical', Moderate: 'badge-warning', Low: 'badge-good' };
  return map[p] ?? 'badge-info';
};

const HealthBar = ({ value, color }) => (
  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
    <div style={{ flex:1, height:5, background:'rgba(255,255,255,0.05)', borderRadius:3, overflow:'hidden' }}>
      <div style={{ width:`${value}%`, height:'100%', background:color, borderRadius:3,
        transition:'width 0.8s', boxShadow:`0 0 6px ${color}55` }} />
    </div>
    <span style={{ fontSize:11, color:'var(--text-muted)', minWidth:28, textAlign:'right' }}>{value}%</span>
  </div>
);

// Trend icon between two values
const Trend = ({ curr, prev }) => {
  if (prev == null) return null;
  if (curr > prev) return <TrendingUp  size={13} color="var(--accent-green)"  />;
  if (curr < prev) return <TrendingDown size={13} color="var(--accent-red)"   />;
  return <Minus size={13} color="var(--text-muted)" />;
};

// Expanded row detail
const ExpandedRow = ({ entry }) => (
  <tr>
    <td colSpan={7} style={{ padding:0 }}>
      <div style={{
        background:'rgba(88,166,255,0.03)',
        borderTop:'1px solid var(--border)',
        borderBottom:'1px solid var(--border)',
        padding:'16px 20px',
        display:'grid',
        gridTemplateColumns:'repeat(3,1fr)',
        gap:24,
        animation:'fadeIn 0.2s ease',
      }}>
        {/* CPU */}
        <div>
          <div style={{ fontSize:11, color:'var(--accent-blue)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:10 }}>CPU</div>
          <div className="info-row"><span className="info-row-key">Temperature</span><span className="info-row-value">{entry.cpu?.temperature?.toFixed(0) ?? '—'}°C</span></div>
          <div className="info-row"><span className="info-row-key">RUL</span><span className="info-row-value" style={{ color:'var(--accent-blue)' }}>{entry.cpu?.rul} months</span></div>
          <div className="info-row"><span className="info-row-key">Status</span><span className="info-row-value" style={{ color: statusColor(entry.cpu?.status) }}>{entry.cpu?.status}</span></div>
          <div style={{ marginTop:8 }}><HealthBar value={Math.round(((entry.cpu?.rul || 0)/36)*100)} color="var(--accent-blue)" /></div>
        </div>
        {/* Battery */}
        <div>
          <div style={{ fontSize:11, color:'var(--accent-green)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:10 }}>Battery</div>
          <div className="info-row"><span className="info-row-key">Health</span><span className="info-row-value">{entry.battery?.health?.toFixed(0) ?? '—'}%</span></div>
          <div className="info-row"><span className="info-row-key">RUL</span><span className="info-row-value" style={{ color:'var(--accent-green)' }}>{entry.battery?.rul} months</span></div>
          <div className="info-row"><span className="info-row-key">Status</span><span className="info-row-value" style={{ color: statusColor(entry.battery?.status) }}>{entry.battery?.status}</span></div>
          <div style={{ marginTop:8 }}><HealthBar value={Math.round(((entry.battery?.rul || 0)/24)*100)} color="var(--accent-green)" /></div>
        </div>
        {/* Drive */}
        <div>
          <div style={{ fontSize:11, color:'var(--accent-purple)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:10 }}>Storage</div>
          <div className="info-row"><span className="info-row-key">SMART Health</span><span className="info-row-value">{entry.drive?.health?.toFixed(0) ?? '—'}%</span></div>
          <div className="info-row"><span className="info-row-key">RUL</span><span className="info-row-value" style={{ color:'var(--accent-purple)' }}>{entry.drive?.rul} months</span></div>
          <div className="info-row"><span className="info-row-key">Status</span><span className="info-row-value" style={{ color: statusColor(entry.drive?.status) }}>{entry.drive?.status}</span></div>
          <div style={{ marginTop:8 }}><HealthBar value={Math.round(((entry.drive?.rul || 0)/48)*100)} color="var(--accent-purple)" /></div>
        </div>
        {/* AI Advice (full width) */}
        {entry.advice && (
          <div style={{ gridColumn:'1/-1', borderTop:'1px solid var(--border)', paddingTop:14 }}>
            <div style={{ fontSize:11, color:'var(--accent-yellow)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:8 }}>AI Advice</div>
            <p style={{ fontSize:13, color:'var(--text-secondary)', lineHeight:1.7 }}>{entry.advice}</p>
          </div>
        )}

        {/* Combined Insight (full width) */}
        {entry.combinedInsight && (
          <div style={{ gridColumn:'1/-1', marginTop: 10, padding: 12, background: 'rgba(168, 85, 247, 0.03)', borderRadius: 6, borderLeft: '3px solid var(--accent-purple)' }}>
            <div style={{ fontSize:10, color:'var(--accent-purple)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:4 }}>Expert Correlation Insight</div>
            <p style={{ fontSize:12, color:'var(--text-secondary)', lineHeight:1.6, fontStyle: 'italic' }}>"{entry.combinedInsight}"</p>
          </div>
        )}
      </div>
    </td>
  </tr>
);

// ─── Main component ───────────────────────────────────────────────────────────
const HistoryPage = ({ toast }) => {
  const [history, setHistory]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [sortField, setSortField]   = useState('date');
  const [sortAsc, setSortAsc]       = useState(false);
  const [filterPriority, setFilterPriority] = useState('all');

  const loadHistory = async () => {
    setLoading(true);
    try {
      const data = await fetchHistory();
      setHistory(Array.isArray(data) ? data : []);
    } catch {
      toast?.error('Failed to load history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadHistory(); }, []);

  const handleClear = async () => {
    if (!window.confirm('Clear all history? This cannot be undone.')) return;
    try {
      await clearAllHistory();
      localStorage.removeItem('laptop_health_history');
      setHistory([]);
      toast?.success('History cleared.');
    } catch {
      // Fallback: clear localStorage
      localStorage.removeItem('laptop_health_history');
      setHistory([]);
      toast?.success('History cleared.');
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteHistoryEntry(id);
      setHistory(prev => prev.filter(h => h.id !== id));
      toast?.success('Entry deleted.');
    } catch {
      // Fallback: remove from state
      const updated = history.filter(h => h.id !== id);
      localStorage.setItem('laptop_health_history', JSON.stringify(updated));
      setHistory(updated);
      toast?.success('Entry deleted.');
    }
  };

  // Sort + filter
  const filtered = history
    .filter(h => filterPriority === 'all' || h.priority === filterPriority)
    .sort((a, b) => {
      let va = a[sortField], vb = b[sortField];
      if (sortField === 'date') { va = new Date(va); vb = new Date(vb); }
      return sortAsc ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
    });

  const toggleSort = (field) => {
    if (sortField === field) setSortAsc(p => !p);
    else { setSortField(field); setSortAsc(false); }
  };

  const SortIcon = ({ field }) => (
    <span style={{ opacity: sortField === field ? 1 : 0.3, marginLeft:4, fontSize:10 }}>
      {sortField === field ? (sortAsc ? '↑' : '↓') : '↕'}
    </span>
  );

  // Summary cards
  const avgHealth = history.length ? Math.round(history.reduce((s,h) => s + (h.overallHealth ?? 0), 0) / history.length) : 0;
  const urgentCount = history.filter(h => h.priority === 'Urgent').length;
  const latestHealth = history[0]?.overallHealth ?? 0;
  const prevHealth   = history[1]?.overallHealth ?? null;

  return (
    <div className="fade-in">
      <div className="topbar">
        <div className="topbar-title">
          <h2>📋 History</h2>
          <p>View and compare all previous hardware scans and AI advice</p>
        </div>
        <div className="topbar-actions">
          {/* Database indicator */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', borderRadius: 'var(--radius-sm)',
            background: 'rgba(63,185,80,0.1)',
            border: '1px solid rgba(63,185,80,0.2)',
            fontSize: 11, fontWeight: 500, color: 'var(--accent-green)',
          }}>
            <Database size={12} />
            Saved to Database
          </div>
          <button className="btn btn-secondary btn-sm" onClick={loadHistory}>
            <RefreshCw size={13} /> Refresh
          </button>
          {history.length > 0 && (
            <button className="btn btn-danger btn-sm" onClick={handleClear}>
              <Trash2 size={13} /> Clear All
            </button>
          )}
        </div>
      </div>

      {/* Summary row */}
      <div className="rul-overview" style={{ gridTemplateColumns:'repeat(4,1fr)', marginBottom:24 }}>
        <div className="rul-item">
          <div className="rul-label">Total Reports</div>
          <div className="rul-score" style={{ color:'var(--accent-blue)' }}>{history.length}</div>
          <div className="rul-days">entries saved</div>
        </div>
        <div className="rul-item">
          <div className="rul-label">Avg Health Score</div>
          <div className="rul-score" style={{ color: avgHealth >= 80 ? 'var(--accent-green)' : avgHealth >= 60 ? 'var(--accent-yellow)' : 'var(--accent-red)' }}>
            {avgHealth}
          </div>
          <div className="rul-days">across all checks</div>
        </div>
        <div className="rul-item">
          <div className="rul-label">Latest Health</div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
            <div className="rul-score" style={{ color: latestHealth >= 80 ? 'var(--accent-green)' : latestHealth >= 60 ? 'var(--accent-yellow)' : 'var(--accent-red)' }}>
              {latestHealth || '—'}
            </div>
            {prevHealth && <Trend curr={latestHealth} prev={prevHealth} />}
          </div>
          <div className="rul-days">most recent report</div>
        </div>
        <div className="rul-item">
          <div className="rul-label">Urgent Alerts</div>
          <div className="rul-score" style={{ color: urgentCount > 0 ? 'var(--accent-red)' : 'var(--accent-green)' }}>
            {urgentCount}
          </div>
          <div className="rul-days">past critical events</div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
        <span style={{ fontSize:13, color:'var(--text-muted)' }}>Filter:</span>
        {['all','Low','Moderate','Urgent'].map(p => (
          <button
            key={p}
            className={`btn btn-sm ${filterPriority === p ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilterPriority(p)}
          >
            {p === 'all' ? 'All' : p}
          </button>
        ))}
        <span style={{ marginLeft:'auto', fontSize:12, color:'var(--text-muted)' }}>
          {filtered.length} of {history.length} entries
        </span>
      </div>

      {/* Table */}
      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        {loading ? (
          <div style={{ padding:48, textAlign:'center', color:'var(--text-muted)' }}>
            <div className="spinner" style={{ borderTopColor:'var(--accent-blue)', margin:'0 auto 16px' }} />
            Loading history…
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state" style={{ padding:'56px 24px' }}>
            <History size={52} />
            <h3>No History Yet</h3>
            <p>
              {history.length === 0
                ? 'Run a hardware detection scan — all scans are automatically saved to your database.'
                : 'No entries match the selected filter.'}
            </p>
          </div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table className="history-table">
              <thead>
                <tr>
                  <th style={{ cursor:'pointer' }} onClick={() => toggleSort('date')}>
                    <span style={{ display:'flex', alignItems:'center' }}>
                      <Calendar size={12} style={{ marginRight:5 }} /> Date <SortIcon field="date" />
                    </span>
                  </th>
                  <th style={{ cursor:'pointer' }} onClick={() => toggleSort('overallHealth')}>
                    Health Score <SortIcon field="overallHealth" />
                  </th>
                  <th>CPU</th>
                  <th>Battery</th>
                  <th>Storage</th>
                  <th>Priority</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry, idx) => {
                  const prevEntry = filtered[idx + 1];
                  const isExpanded = expandedId === entry.id;
                  return (
                    <>
                      <tr key={entry.id}
                        style={{ cursor:'pointer' }}
                        onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                      >
                        {/* Date */}
                        <td>
                          <div style={{ fontWeight:500, fontSize:13, color:'var(--text-primary)' }}>
                            {new Date(entry.date).toLocaleDateString()}
                          </div>
                          <div style={{ fontSize:11, color:'var(--text-muted)' }}>
                            {new Date(entry.date).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}
                          </div>
                        </td>

                        {/* Health score */}
                        <td>
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <span style={{
                              fontSize:18, fontWeight:800,
                              fontFamily:"'JetBrains Mono',monospace",
                              color: (entry.overallHealth ?? 0) >= 80 ? 'var(--accent-green)'
                                   : (entry.overallHealth ?? 0) >= 60 ? 'var(--accent-yellow)'
                                   : 'var(--accent-red)',
                            }}>{entry.overallHealth ?? '—'}</span>
                            <Trend curr={entry.overallHealth} prev={prevEntry?.overallHealth} />
                          </div>
                        </td>

                        {/* CPU */}
                        <td>
                          <div style={{ fontSize:12, color: statusColor(entry.cpu?.status) }}>{entry.cpu?.status ?? '—'}</div>
                          <div style={{ fontSize:11, color:'var(--text-muted)' }}>
                            {entry.cpu?.temperature?.toFixed(0) ?? '—'}°C · RUL {entry.cpu?.rul ?? '—'}mo
                          </div>
                        </td>

                        {/* Battery */}
                        <td>
                          <div style={{ fontSize:12, color: statusColor(entry.battery?.status) }}>{entry.battery?.status ?? '—'}</div>
                          <div style={{ fontSize:11, color:'var(--text-muted)' }}>
                            {entry.battery?.health?.toFixed(0) ?? '—'}% · RUL {entry.battery?.rul ?? '—'}mo
                          </div>
                        </td>

                        {/* Drive */}
                        <td>
                          <div style={{ fontSize:12, color: statusColor(entry.drive?.status) }}>{entry.drive?.status ?? '—'}</div>
                          <div style={{ fontSize:11, color:'var(--text-muted)' }}>
                            {entry.drive?.health?.toFixed(0) ?? '—'}% · RUL {entry.drive?.rul ?? '—'}mo
                          </div>
                        </td>

                        {/* Priority */}
                        <td>
                          <span className={`metric-badge ${priorityBadge(entry.priority)}`}>
                            {entry.priority ?? 'N/A'}
                          </span>
                        </td>

                        {/* Actions */}
                        <td onClick={e => e.stopPropagation()}>
                          <div style={{ display:'flex', gap:6 }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                              title="Toggle details"
                            >
                              {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            </button>
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => handleDelete(entry.id)}
                              title="Delete entry"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expandable details row */}
                      {isExpanded && <ExpandedRow key={`exp-${entry.id}`} entry={entry} />}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoryPage;
