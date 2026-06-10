/**
 * UserForm (AI Advisor page)
 * Collects user responses to symptom questions and sends them with
 * hardware data to the LLM for analysis.
 */
import { useState } from 'react';
import { Brain, Send, Lightbulb, AlertTriangle, ShieldCheck, Clock, RefreshCw } from 'lucide-react';
import { sendToLLM } from '../utils/api';

const RadioGroup = ({ label, name, value, onChange, options }) => (
  <div className="form-group">
    <label className="form-label">{label}</label>
    <div className="radio-group">
      {options.map(opt => (
        <label
          key={opt.value}
          className={`radio-option ${value === opt.value ? 'selected' : ''}`}
        >
          <input
            type="radio"
            name={name}
            value={opt.value}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
          />
          {opt.emoji} {opt.label}
        </label>
      ))}
    </div>
  </div>
);

const yesNoOptions = [
  { value: 'yes',     label: 'Yes',     emoji: '✅' },
  { value: 'no',      label: 'No',      emoji: '❌' },
  { value: 'unsure',  label: 'Unsure',  emoji: '❓' },
];

const PriorityTag = ({ priority }) => {
  const map = {
    Urgent:   { color: 'var(--accent-red)',    bg: 'rgba(255,123,114,0.1)', border: 'rgba(255,123,114,0.2)' },
    Moderate: { color: 'var(--accent-yellow)', bg: 'rgba(210,153,34,0.1)', border: 'rgba(210,153,34,0.2)' },
    Low:      { color: 'var(--accent-green)',  bg: 'rgba(63,185,80,0.1)',  border: 'rgba(63,185,80,0.2)'  },
  };
  const s = map[priority] ?? map.Low;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700,
      color: s.color, background: s.bg, border: `1px solid ${s.border}`,
      textTransform: 'uppercase', letterSpacing: '0.5px',
    }}>
      {priority === 'Urgent' ? '🚨' : priority === 'Moderate' ? '⚠️' : '✅'} {priority} Priority
    </span>
  );
};

const UserForm = ({ hardware, llmAnalysis, setLlmAnalysis, userResponses, setUserResponses, onSave, toast }) => {
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('form');

  const handleChange = (field, value) => {
    setUserResponses(prev => ({ ...prev, [field]: value }));
  };

  const handleSend = async () => {
    if (!hardware) {
      toast?.error('Please detect hardware status first before sending to AI.');
      return;
    }
    setLoading(true);
    try {
      const result = await sendToLLM(hardware, userResponses);
      setLlmAnalysis(result);
      setTab('results');
      // Auto-save to history
      if (onSave) {
        await onSave({
          date: new Date().toISOString(),
          overallHealth: hardware.overallHealth,
          cpu: { temperature: hardware.cpu.temperature, rul: hardware.cpu.rul, status: hardware.cpu.status },
          battery: { health: hardware.battery.health, rul: hardware.battery.rul, status: hardware.battery.status },
          drive: { health: hardware.drive.health, rul: hardware.drive.rul, status: hardware.drive.status },
          advice: result.summary,
          combinedInsight: result.combined_insight,
          priority: result.priority,
        });
      }
      toast?.success('AI analysis complete!');
    } catch {
      toast?.error('AI analysis failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fade-in">
      <div className="topbar">
        <div className="topbar-title">
          <h2>AI Advisor</h2>
          <p>Answer symptom questions below and get personalised maintenance recommendations</p>
        </div>
        {llmAnalysis && (
          <PriorityTag priority={llmAnalysis.priority} />
        )}
      </div>

      {/* Hardware status reminder */}
      {!hardware && (
        <div className="alert alert-warning" style={{ marginBottom: 20 }}>
          <AlertTriangle size={15} />
          <span>No hardware data detected yet. Go to <strong>Detect Hardware</strong> first for the most accurate AI analysis.</span>
        </div>
      )}

      <div className="dashboard-grid">
        {/* Left: Form */}
        <div>
          <div className="tab-bar">
            <button className={`tab-btn ${tab === 'form' ? 'active' : ''}`} onClick={() => setTab('form')}>Symptom Form</button>
            <button className={`tab-btn ${tab === 'results' ? 'active' : ''}`} onClick={() => setTab('results')} disabled={!llmAnalysis}>
              AI Analysis {llmAnalysis && '✓'}
            </button>
          </div>

          {tab === 'form' && (
            <div className="card slide-in">
              <div style={{ marginBottom: 24 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
                  <span style={{ fontWeight:700, fontSize:16 }}>AI Advisor</span>
                </div>
                <p style={{ fontSize:13, color:'var(--text-muted)' }}>
                  What issue are you facing? (slow, overheating, shutdown, noise)
                </p>
              </div>

              <RadioGroup
                label="1. What issue are you facing?"
                name="issue"
                value={userResponses.issue}
                onChange={v => handleChange('issue', v)}
                options={[
                  { value: 'slow', label: 'Slow', emoji: '🐌' },
                  { value: 'overheating', label: 'Overheating', emoji: '🔥' },
                  { value: 'shutdown', label: 'Shutdown', emoji: '⚠️' },
                  { value: 'noise', label: 'Noise', emoji: '🔊' },
                  { value: 'other', label: 'Other', emoji: '📝' },
                ]}
              />
              {userResponses.issue === 'other' && (
                <div className="form-group slide-in" style={{ marginTop: -10, marginBottom: 20 }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Describe your situation..."
                    value={userResponses.issueOther || ''}
                    onChange={e => handleChange('issueOther', e.target.value)}
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                  />
                </div>
              )}
              
              <RadioGroup
                label="2. When does it happen?"
                name="timing"
                value={userResponses.timing}
                onChange={v => handleChange('timing', v)}
                options={[
                  { value: 'startup', label: 'Startup', emoji: '🚀' },
                  { value: 'gaming', label: 'Gaming', emoji: '🎮' },
                  { value: 'random', label: 'Random', emoji: '❓' },
                  { value: 'always', label: 'Always', emoji: '🔄' },
                  { value: 'other', label: 'Other', emoji: '📝' },
                ]}
              />
              {userResponses.timing === 'other' && (
                <div className="form-group slide-in" style={{ marginTop: -10, marginBottom: 20 }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="When exactly does it happen?"
                    value={userResponses.timingOther || ''}
                    onChange={e => handleChange('timingOther', e.target.value)}
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                  />
                </div>
              )}

              <RadioGroup
                label="3. Are you using heavy applications?"
                name="heavyApps"
                value={userResponses.heavyApps}
                onChange={v => handleChange('heavyApps', v)}
                options={[
                  { value: 'yes', label: 'Yes', emoji: '✅' },
                  { value: 'no', label: 'No', emoji: '❌' },
                  { value: 'other', label: 'Other', emoji: '📝' },
                ]}
              />
              {userResponses.heavyApps === 'other' && (
                <div className="form-group slide-in" style={{ marginTop: -10, marginBottom: 20 }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Which apps are you using?"
                    value={userResponses.heavyAppsOther || ''}
                    onChange={e => handleChange('heavyAppsOther', e.target.value)}
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                  />
                </div>
              )}

              <RadioGroup
                label="4. How old is your laptop?"
                name="age"
                value={userResponses.age}
                onChange={v => handleChange('age', v)}
                options={[
                  { value: 'new', label: 'New', emoji: '✨' },
                  { value: '1-2 yrs', label: '1-2 years', emoji: '📅' },
                  { value: '3-5 yrs', label: '3-5 years', emoji: '🕰️' },
                  { value: '5+ yrs', label: '5+ years', emoji: '⏳' },
                  { value: 'other', label: 'Other', emoji: '📝' },
                ]}
              />
              {userResponses.age === 'other' && (
                <div className="form-group slide-in" style={{ marginTop: -10, marginBottom: 20 }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Enter exact age or model year..."
                    value={userResponses.ageOther || ''}
                    onChange={e => handleChange('ageOther', e.target.value)}
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                  />
                </div>
              )}

              <RadioGroup
                label="5. Any recent changes?"
                name="changes"
                value={userResponses.changes}
                onChange={v => handleChange('changes', v)}
                options={[
                  { value: 'software install', label: 'Software install', emoji: '📦' },
                  { value: 'update', label: 'Update', emoji: '🆙' },
                  { value: 'none', label: 'None', emoji: '✅' },
                  { value: 'other', label: 'Other', emoji: '📝' },
                ]}
              />
              {userResponses.changes === 'other' && (
                <div className="form-group slide-in" style={{ marginTop: -10, marginBottom: 20 }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Describe recent changes..."
                    value={userResponses.changesOther || ''}
                    onChange={e => handleChange('changesOther', e.target.value)}
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                  />
                </div>
              )}

              <RadioGroup
                label="6. How often do you use it daily?"
                name="usage"
                value={userResponses.usage}
                onChange={v => handleChange('usage', v)}
                options={[
                  { value: 'light', label: 'Light', emoji: '🌱' },
                  { value: 'moderate', label: 'Moderate', emoji: '⚡' },
                  { value: 'heavy', label: 'Heavy', emoji: '🏗️' },
                  { value: 'other', label: 'Other', emoji: '📝' },
                ]}
              />
              {userResponses.usage === 'other' && (
                <div className="form-group slide-in" style={{ marginTop: -10, marginBottom: 20 }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Describe your usage pattern..."
                    value={userResponses.usageOther || ''}
                    onChange={e => handleChange('usageOther', e.target.value)}
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                  />
                </div>
              )}

              <div style={{ display:'flex', gap:12, marginTop:8 }}>
                <button
                  className="btn btn-primary btn-lg"
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={handleSend}
                  disabled={loading}
                  id="send-to-llm-btn"
                >
                  {loading ? <><div className="spinner" /> Analysing with AI…</> : <><Send size={15} /> Send to AI Advisor</>}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => setUserResponses({
                    issue:'', issueOther:'', timing:'', timingOther:'',
                    heavyApps:'', heavyAppsOther:'', age:'', ageOther:'',
                    changes:'', changesOther:'', usage:'', usageOther:'',
                  })}
                >
                  <RefreshCw size={14} />
                </button>
              </div>
            </div>
          )}

          {tab === 'results' && llmAnalysis && (
            <div className="slide-in" style={{ display:'flex', flexDirection:'column', gap:16 }}>
              {/* Recommendation Summary */}
              <div className="card">
                <div style={{ display:'flex', alignItems:'center', justify:'space-between', marginBottom:14 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <Brain size={18} color="var(--accent-purple)" />
                    <span style={{ fontWeight:700 }}>Recommendation Summary</span>
                  </div>
                </div>
                <div className="llm-output">
                  <p style={{ lineHeight:1.8, fontSize: 14, color:'var(--text-primary)' }}>
                    {(() => {
                      // Build a real recommendation paragraph from hardware predictions + user questionnaire
                      const cpuRul = hardware?.cpu?.rul || 0;
                      const cpuTemp = hardware?.cpu?.temperature || 0;
                      const cpuStatus = hardware?.cpu?.status || 'Unknown';
                      const batteryHealth = hardware?.battery?.health || 0;
                      const batteryRul = hardware?.battery?.rul || 0;
                      const batteryStatus = hardware?.battery?.status || 'Unknown';
                      const driveHealth = hardware?.drive?.health || 0;
                      const driveRul = hardware?.drive?.rul || 0;
                      const driveStatus = hardware?.drive?.status || 'Unknown';
                      const userIssue = userResponses?.issue || '';
                      const userTiming = userResponses?.timing || '';
                      const userUsage = userResponses?.usage || '';
                      const userAge = userResponses?.age || '';

                      let parts = [];

                      // CPU assessment
                      if (cpuTemp > 80 || cpuStatus === 'Critical') {
                        parts.push(`Your CPU is running at ${cpuTemp.toFixed(0)}°C which is above safe limits with an estimated remaining life of ${cpuRul} months — we recommend cleaning the thermal paste and improving airflow immediately.`);
                      } else if (cpuTemp > 70 || cpuStatus === 'Warning') {
                        parts.push(`Your processor temperature is elevated at ${cpuTemp.toFixed(0)}°C with approximately ${cpuRul} months of predicted life remaining — consider cleaning internal fans and ensuring proper ventilation.`);
                      } else {
                        parts.push(`Your CPU is operating within safe thermal limits at ${cpuTemp.toFixed(0)}°C with ${cpuRul} months of predicted lifespan remaining.`);
                      }

                      // Battery assessment
                      if (batteryHealth < 50 || batteryStatus === 'Critical') {
                        parts.push(`Battery health is critically low at ${batteryHealth}% with only ${batteryRul} months of useful life left — battery replacement is strongly recommended to avoid unexpected shutdowns.`);
                      } else if (batteryHealth < 75 || batteryStatus === 'Warning') {
                        parts.push(`Battery health is at ${batteryHealth}% with roughly ${batteryRul} months remaining — avoid keeping it plugged in at 100% and try to maintain charge between 20-80% to extend its lifespan.`);
                      } else {
                        parts.push(`Battery health is good at ${batteryHealth}% with an estimated ${batteryRul} months of life remaining.`);
                      }

                      // Drive assessment
                      if (driveHealth < 50 || driveStatus === 'Critical') {
                        parts.push(`Your storage drive health is at a critical ${driveHealth}% — back up your important data immediately and plan for a drive replacement within the next ${driveRul} months.`);
                      } else if (driveHealth < 75 || driveStatus === 'Warning') {
                        parts.push(`Storage drive health is at ${driveHealth}% with ${driveRul} months of predicted life — regular backups are recommended as a precaution.`);
                      }

                      // User context
                      if (userIssue === 'overheating' || userIssue === 'shutdown') {
                        parts.push(`Based on your reported ${userIssue} issues${userTiming ? ` occurring during ${userTiming}` : ''}, we suggest reducing heavy workloads and checking your laptop's cooling system.`);
                      } else if (userIssue === 'slow') {
                        parts.push(`The slowness you're experiencing${userUsage === 'heavy' ? ' combined with heavy daily usage' : ''} may be improved by closing background applications, upgrading RAM, or switching to an SSD if you haven't already.`);
                      }

                      // Pick the most relevant 3-4 sentences
                      return parts.slice(0, 4).join(' ');
                    })()}
                  </p>
                </div>
                
                <div style={{ display:'flex', gap:16, marginTop:16, flexWrap:'wrap' }}>
                  <div style={{ textAlign:'center', flex:1 }}>
                    <div style={{ fontSize:28, fontWeight:800, color:'var(--accent-blue)', fontFamily:"'JetBrains Mono',monospace" }}>
                      {llmAnalysis.efficiency}%
                    </div>
                    <div style={{ fontSize:11, color:'var(--text-muted)' }}>Efficiency Score</div>
                  </div>
                  <div style={{ textAlign:'center', flex:1 }}>
                    <div style={{ fontSize:28, fontWeight:800, color:'var(--accent-green)', fontFamily:"'JetBrains Mono',monospace" }}>
                      {llmAnalysis.estimatedLifespan}yr
                    </div>
                    <div style={{ fontSize:11, color:'var(--text-muted)' }}>Est. Lifespan</div>
                  </div>
                  <div style={{ textAlign:'center', flex:1 }}>
                    <PriorityTag priority={llmAnalysis.priority} />
                    <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:8 }}>Action Priority</div>
                  </div>
                </div>
              </div>

              {/* Possible Causes */}
              <div className="card">
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
                  <Brain size={18} color="var(--accent-purple)" />
                  <span style={{ fontWeight:700 }}>Possible Causes</span>
                </div>
                <div className="llm-output">
                  <p style={{ lineHeight:1.8, fontSize: 13, color:'var(--text-secondary)' }}>{llmAnalysis.possible_causes}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Recommendations + Analysis Details + Key Issues */}
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {llmAnalysis ? (
            <>
              <div className="card">
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
                  <Lightbulb size={18} color="var(--accent-yellow)" />
                  <span style={{ fontWeight:700 }}>Advice</span>
                </div>
                <div style={{ 
                  padding:'16px',
                  background:'rgba(251,191,36,0.05)',
                  border:'1px solid rgba(251,191,36,0.1)',
                  borderRadius:12,
                  fontSize:14,
                  lineHeight:1.6,
                  color:'var(--text-primary)',
                  whiteSpace: 'pre-wrap'
                }}>
                  {llmAnalysis.advice}
                </div>
              </div>

              <div className="card">
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
                  <Clock size={18} color="var(--accent-blue)" />
                  <span style={{ fontWeight:700 }}>Analysis Details</span>
                </div>
                <div className="info-row"><span className="info-row-key">Analysed by</span><span className="info-row-value">{llmAnalysis.model}</span></div>
                <div className="info-row"><span className="info-row-key">Analysis time</span><span className="info-row-value">{new Date(llmAnalysis.analysedAt).toLocaleString()}</span></div>
              </div>

              {/* Key Issues - Below Analysis Details */}
              <div className="card" style={{ maxHeight: '280px', overflow: 'auto' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
                  <AlertTriangle size={18} color="var(--accent-red)" />
                  <span style={{ fontWeight:700 }}>Key Issues Detected</span>
                </div>
                <div className="llm-output">
                  <p style={{ lineHeight:1.8, fontSize: 13, color:'var(--text-secondary)' }}>{llmAnalysis.issues_detected}</p>
                </div>
              </div>
            </>
          ) : (
            <div className="card">
              <div className="empty-state">
                <Brain size={48} />
                <h3>AI Advisor</h3>
                <p>Fill in the symptom questionnaire and click <strong>Send to AI Advisor</strong> to get personalised recommendations.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserForm;
