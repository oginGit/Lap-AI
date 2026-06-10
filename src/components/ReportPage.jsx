/**
 * ReportPage — generate and preview PDF reports
 */
import { useState } from 'react';
import { FileText, Download, Eye, AlertCircle, CheckCircle2 } from 'lucide-react';
import { generatePDFReport } from '../utils/pdfGenerator';

const ReportPage = ({ hardware, llmAnalysis, userResponses, toast }) => {
  const [generating, setGenerating] = useState(false);
  const [lastGenerated, setLastGenerated] = useState(null);

  const handleGenerate = async () => {
    if (!hardware) {
      toast?.error('Please run a hardware detection scan first.');
      return;
    }
    setGenerating(true);
    try {
      // Small delay for UX
      await new Promise(r => setTimeout(r, 600));
      const fileName = generatePDFReport(hardware, llmAnalysis, userResponses);
      setLastGenerated(fileName);
      toast?.success(`PDF saved: ${fileName}`);
    } catch (e) {
      toast?.error('Failed to generate PDF report.');
      console.error(e);
    } finally {
      setGenerating(false);
    }
  };

  const readiness = [
    { label: 'Hardware data detected', done: !!hardware },
    { label: 'CPU metrics available', done: !!hardware?.cpu },
    { label: 'Battery data available', done: !!hardware?.battery },
    { label: 'Drive SMART data ready', done: !!hardware?.drive },
    { label: 'AI analysis completed', done: !!llmAnalysis },
    { label: 'User symptoms recorded', done: !!userResponses?.issue },
  ];

  const readyCount = readiness.filter(r => r.done).length;
  const allReady = readyCount === readiness.length;

  return (
    <div className="fade-in">
      <div className="topbar">
        <div className="topbar-title">
          <h2>📄 PDF Report</h2>
          <p>Generate a comprehensive hardware health report in PDF format</p>
        </div>
      </div>

      <div className="report-grid">
        {/* Left panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Readiness checklist */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <div className="card-icon" style={{ background: 'rgba(88,166,255,0.1)' }}>
                  <Eye size={18} color="var(--accent-blue)" />
                </div>
                <h3>Report Readiness</h3>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {readiness.map((item, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px',
                  background: item.done ? 'rgba(63,185,80,0.06)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${item.done ? 'rgba(63,185,80,0.15)' : 'var(--border)'}`,
                  borderRadius: 8,
                  fontSize: 13,
                  color: item.done ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontWeight: item.done ? 500 : 400,
                }}>
                  {item.done
                    ? <CheckCircle2 size={16} color="var(--accent-green)" />
                    : <AlertCircle size={16} color="var(--text-muted)" />
                  }
                  {item.label}
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Right panel: Preview */}
        <div className="card1">
          <div className="card-header">
            <div className="card-title">
              <div className="card-icon" style={{ background: 'rgba(188,140,255,0.1)' }}>
                <FileText size={18} color="var(--accent-purple)" />
              </div>
              <h3>Report Preview</h3>
            </div>
          </div>

          {hardware ? (
            <div style={{
              background: 'var(--bg-card)',
              borderRadius: 12,
              padding: '40px 60px',
              border: '1px solid var(--border)',
              fontFamily: "'Inter', sans-serif",
              fontSize: 13,
              lineHeight: 1.6,
              boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
              width: '100%',
              margin: '0 auto',
              color: 'var(--text-primary)'
            }}>
              {/* Cover */}
              <div style={{ background: 'var(--accent-purple)', padding: '14px 20px', borderRadius: 10, marginBottom: 16 }}>
                <div style={{ color: 'white', fontWeight: 800, fontSize: 18, fontFamily: 'Inter,sans-serif', letterSpacing: '1px' }}>
                  LAPGUARD-AI
                </div>
                <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: 11, marginTop: 2, fontFamily: 'Inter,sans-serif', fontWeight: 500 }}>
                  Care beyond maintenance
                </div>
                <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 9, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  PROFESSIONAL HARDWARE HEALTH & MAINTENANCE ADVISORY
                </div>
                <div style={{ marginTop: 12, display: 'flex', gap: 20, alignItems: 'center' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      fontSize: 22, fontWeight: 900,
                      color: hardware.overallHealth >= 80 ? '#4ade80' : hardware.overallHealth >= 60 ? '#fbbf24' : '#f87171'
                    }}>{hardware.overallHealth}</div>
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 8, fontWeight: 700 }}>SCORE</div>
                  </div>
                  <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.1)' }} />
                  <div>
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 8, fontWeight: 700 }}>GENERATED</div>
                    <div style={{ color: 'white', fontSize: 10, fontWeight: 500 }}>{new Date().toLocaleString()}</div>
                  </div>
                </div>
              </div>

              {/* Metrics preview */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                {[
                  { label: 'CPU', val: `${hardware.cpu.temperature.toFixed(0)}°C / ${hardware.cpu.usage}%` },
                  { label: 'BAT', val: `${hardware.battery.health.toFixed(0)}% health` },
                  { label: 'HDD', val: `${hardware.drive.health.toFixed(0)}% SMART` },
                  { label: 'RUL', val: `${hardware.cpu.rul}mo est.` },
                ].map(c => (
                  <div key={c.label} style={{ fontSize: 10, color: '#94a3b8' }}>
                    <span style={{ color: 'var(--accent-purple)', marginRight: 6 }}>{c.label}:</span>
                    {c.val}
                  </div>
                ))}
              </div>

              {llmAnalysis && (
                <>
                  <div style={{ borderTop: '1px solid #1e293b', margin: '10px 0' }} />
                  <div style={{ color: 'var(--accent-purple)', marginBottom: 6, fontFamily: 'Inter,sans-serif', fontSize: 10, fontWeight: 600 }}>SYSTEM HEALTH SUMMARY</div>
                  <div style={{ color: '#94a3b8', fontSize: 10, fontFamily: 'Inter,sans-serif', lineHeight: 1.6 }}>
                    {llmAnalysis.summary.substring(0, 200)}…
                  </div>
                  {llmAnalysis.advice && (
                    <div style={{ marginTop: 8, color: 'var(--accent-purple)', fontSize: 10, fontStyle: 'italic' }}>
                      "Advice: {llmAnalysis.advice.substring(0, 100)}…"
                    </div>
                  )}
                </>
              )}


            </div>
          ) : (
            <div className="empty-state">
              <FileText size={40} />
              <h3>No Data to Preview</h3>
              <p>Run a hardware detection to populate the report preview.</p>
            </div>
          )}

          {/* Moved Generate Controls */}
          <div style={{
            marginTop: 24,
            paddingTop: 24,
            borderTop: '1px solid var(--border)',
            textAlign: 'center'
          }}>
            <button
              className="btn btn-primary btn-lg"
              style={{ justifyContent: 'center', minWidth: 280, margin: '0 auto' }}
              onClick={handleGenerate}
              disabled={generating || !hardware}
              id="generate-pdf-btn"
            >
              {generating
                ? <><div className="spinner" /> Generating PDF…</>
                : <><Download size={16} /> Generate &amp; Download PDF</>
              }
            </button>

            {!hardware && (
              <p style={{ fontSize: 12, color: 'var(--accent-yellow)', marginTop: 12 }}>
                ⚠️ Run a hardware scan first to enable report generation.
              </p>
            )}

            {lastGenerated && (
              <div className="alert alert-success" style={{ marginTop: 16, textAlign: 'left', maxWidth: 400, margin: '16px auto 0' }}>
                <CheckCircle2 size={15} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>PDF Generated Successfully</div>
                  <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>{lastGenerated}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportPage;
