/**
 * DetectPage — Dedicated hardware detection page
 * Shows live scan animation with detailed results post-detection.
 * Connected to real Python backend.
 */
import { useState } from 'react';
import { RefreshCw, Cpu, Battery, HardDrive, Thermometer, Zap, CheckCircle2, AlertCircle, Clock, Activity } from 'lucide-react';
import { fetchHardwareStatus } from '../utils/api';

const ScanStep = ({ label, done, active }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 16px',
    borderRadius: 8,
    background: active ? 'rgba(88,166,255,0.08)' : done ? 'rgba(63,185,80,0.06)' : 'transparent',
    border: `1px solid ${active ? 'rgba(88,166,255,0.2)' : done ? 'rgba(63,185,80,0.15)' : 'transparent'}`,
    transition: 'all 0.3s ease',
    marginBottom: 8,
  }}>
    {done ? (
      <CheckCircle2 size={18} color="var(--accent-green)" />
    ) : active ? (
      <div className="spinner" style={{ borderTopColor: 'var(--accent-blue)' }} />
    ) : (
      <Clock size={18} color="var(--text-muted)" />
    )}
    <span style={{
      fontSize: 14,
      color: active ? 'var(--accent-blue)' : done ? 'var(--accent-green)' : 'var(--text-muted)',
      fontWeight: active || done ? 600 : 400,
    }}>{label}</span>
  </div>
);

const steps = [
  'Connecting to hardware monitor backend...',
  'Reading CPU temperature & usage via sensors...',
  'Checking battery health, cycles & voltage...',
  'Running SMART drive diagnostics...',
  'Calculating health scores & RUL predictions...',
  'Generating 6-month degradation forecast...',
];

const DetectPage = ({ hardware, setHardware, toast }) => {
  const [detecting, setDetecting] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [doneSteps, setDoneSteps] = useState([]);

  const handleDetect = async () => {
    setDetecting(true);
    setDoneSteps([]);

    // Animate through steps
    for (let i = 0; i < steps.length; i++) {
      setCurrentStep(i);
      await new Promise(r => setTimeout(r, 300));
      setDoneSteps(prev => [...prev, i]);
    }

    try {
      const data = await fetchHardwareStatus();
      if (data.error) {
        throw new Error(data.error);
      }
      setHardware(data);
      toast?.success('Hardware detection complete — real data loaded!');
    } catch (e) {
      const msg = e.message || 'Unknown error';
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('timed out')) {
        toast?.error('Cannot connect to backend. Please start the Python server: cd backend && python app.py');
      } else if (msg.includes('500') || msg.includes('505')) {
        toast?.error('Backend error — the hardware monitor service encountered an issue. Restart the backend server.');
      } else {
        toast?.error(`Detection failed: ${msg}`);
      }
    } finally {
      setDetecting(false);
      setCurrentStep(-1);
    }
  };

  const getStatusIcon = (status) => {
    if (status === 'Good')     return <CheckCircle2 size={16} color="var(--accent-green)" />;
    if (status === 'Warning')  return <AlertCircle  size={16} color="var(--accent-yellow)" />;
    return <AlertCircle size={16} color="var(--accent-red)" />;
  };

  const getStatusBadge = (status) => {
    const cls = status === 'Good' ? 'badge-good' : status === 'Warning' ? 'badge-warning' : 'badge-critical';
    return <span className={`metric-badge ${cls}`} style={{ marginLeft:'auto' }}>{status}</span>;
  };

  return (
    <div className="fade-in">
      <div className="topbar">
        <div className="topbar-title">
          <h2>🔍 Detect Hardware</h2>
          <p>Run a full system scan to get real-time hardware metrics and RUL calculations</p>
        </div>
      </div>

      <div className="content-grid">
        {/* Scan panel */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <div className="card-icon" style={{ background: 'rgba(88,166,255,0.1)' }}>
                <RefreshCw size={18} color="var(--accent-blue)" />
              </div>
              <h3>Hardware Scanner</h3>
            </div>
          </div>

          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
            The scanner connects to the Python backend to read real CPU temperature, battery health (cycles, voltage, capacity),
            and drive SMART data, then applies degradation models to calculate Remaining Useful Life (RUL) predictions.
          </p>

          {/* Step list */}
          <div style={{ marginBottom: 24 }}>
            {steps.map((step, i) => (
              <ScanStep
                key={i}
                label={step}
                active={currentStep === i}
                done={doneSteps.includes(i)}
              />
            ))}
          </div>

          <button
            className="btn btn-primary btn-lg"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={handleDetect}
            disabled={detecting}
            id="run-scan-btn"
          >
            {detecting ? <><div className="spinner" /> Scanning…</> : <><RefreshCw size={16} /> Start Hardware Scan</>}
          </button>

          {hardware && !detecting && (
            <div className="alert alert-success" style={{ marginTop: 16 }}>
              <CheckCircle2 size={15} />
              <span>Last scan completed at {new Date(hardware.timestamp).toLocaleTimeString()}</span>
            </div>
          )}
        </div>

        {/* Results panel */}
        {hardware ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* CPU result */}
            <div className="card" style={{ borderTop: '3px solid var(--accent-blue)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
                <Cpu size={20} color="var(--accent-blue)" />
                <span style={{ fontWeight:700, fontSize:16 }}>CPU</span>
                {getStatusIcon(hardware.cpu.status)}
                {getStatusBadge(hardware.cpu.status)}
              </div>
              <div className="info-row"><span className="info-row-key">Temperature</span><span className="info-row-value" style={{ color: hardware.cpu.temperature > 80 ? 'var(--accent-red)' : 'var(--accent-green)' }}>{hardware.cpu.temperature.toFixed(1)}°C</span></div>
              <div className="info-row"><span className="info-row-key">Usage</span><span className="info-row-value">{hardware.cpu.usage.toFixed(1)}%</span></div>
              <div className="info-row"><span className="info-row-key">Model</span><span className="info-row-value">{hardware.cpu.model}</span></div>
              <div className="info-row"><span className="info-row-key">Health Score</span><span className="info-row-value" style={{ color:'var(--accent-blue)' }}>{hardware.cpu.healthScore || hardware.cpu.rulPercent}/100</span></div>
              <div className="info-row"><span className="info-row-key">RUL</span><span className="info-row-value" style={{ color:'var(--accent-blue)' }}>{hardware.cpu.rul} months ({hardware.cpu.rulPercent}%)</span></div>
            </div>

            {/* Battery result */}
            <div className="card" style={{ borderTop: '3px solid var(--accent-green)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
                <Battery size={20} color="var(--accent-green)" />
                <span style={{ fontWeight:700, fontSize:16 }}>Battery</span>
                {getStatusIcon(hardware.battery.status)}
                {getStatusBadge(hardware.battery.status)}
              </div>
              <div className="info-row"><span className="info-row-key">Health Score</span><span className="info-row-value" style={{ color: hardware.battery.health >= 80 ? 'var(--accent-green)' : 'var(--accent-yellow)' }}>{typeof hardware.battery.health === 'number' ? hardware.battery.health.toFixed(0) : hardware.battery.health}%</span></div>
              <div className="info-row"><span className="info-row-key">Charge Level</span><span className="info-row-value">{hardware.battery.percent?.toFixed(0) || '—'}%</span></div>
              <div className="info-row"><span className="info-row-key">Cycle Count</span><span className="info-row-value">{hardware.battery.cycles}</span></div>
              <div className="info-row"><span className="info-row-key">Voltage</span><span className="info-row-value">{hardware.battery.voltage?.toFixed(2) || '—'} V</span></div>
              <div className="info-row"><span className="info-row-key">Discharge Rate</span><span className="info-row-value">{hardware.battery.dischargeRate?.toFixed(1) || '0'} %/hr</span></div>
              <div className="info-row"><span className="info-row-key">Temperature</span><span className="info-row-value">{hardware.battery.temperature?.toFixed(1) || '—'}°C</span></div>
              <div className="info-row"><span className="info-row-key">Charging</span><span className="info-row-value">{hardware.battery.isCharging ? '⚡ Charging' : '🔋 On Battery'}</span></div>
              <div className="info-row"><span className="info-row-key">RUL</span><span className="info-row-value" style={{ color:'var(--accent-green)' }}>{hardware.battery.rul} months ({hardware.battery.rulPercent}%)</span></div>
            </div>

            {/* Drive result */}
            <div className="card" style={{ borderTop: '3px solid var(--accent-purple)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
                <HardDrive size={20} color="var(--accent-purple)" />
                <span style={{ fontWeight:700, fontSize:16 }}>Storage</span>
                {getStatusIcon(hardware.drive.status)}
                {getStatusBadge(hardware.drive.status)}
              </div>
              <div className="info-row"><span className="info-row-key">SMART Health</span><span className="info-row-value" style={{ color: hardware.drive.health > 80 ? 'var(--accent-green)' : 'var(--accent-yellow)' }}>{typeof hardware.drive.health === 'number' ? hardware.drive.health.toFixed(0) : hardware.drive.health}%</span></div>
              <div className="info-row"><span className="info-row-key">Type</span><span className="info-row-value">{hardware.drive.type}</span></div>
              <div className="info-row"><span className="info-row-key">Model</span><span className="info-row-value">{hardware.drive.model}</span></div>
              <div className="info-row"><span className="info-row-key">Temperature</span><span className="info-row-value">{hardware.drive.temperature?.toFixed(1) || '—'}°C</span></div>
              <div className="info-row"><span className="info-row-key">Reallocated Sectors</span><span className="info-row-value" style={{ color: hardware.drive.reallocatedSectors > 5 ? 'var(--accent-red)' : 'var(--accent-green)' }}>{hardware.drive.reallocatedSectors}</span></div>
              <div className="info-row"><span className="info-row-key">Pending Sectors</span><span className="info-row-value" style={{ color: (hardware.drive.pendingSectors || 0) > 0 ? 'var(--accent-red)' : 'var(--accent-green)' }}>{hardware.drive.pendingSectors || 0}</span></div>
              <div className="info-row"><span className="info-row-key">Power-On Hours</span><span className="info-row-value">{hardware.drive.powerOnHours?.toLocaleString() || '—'} hrs</span></div>
              <div className="info-row"><span className="info-row-key">Spin Retries</span><span className="info-row-value">{hardware.drive.spinRetryCount || 0}</span></div>
              <div className="info-row"><span className="info-row-key">Storage</span><span className="info-row-value">{hardware.drive.used?.toFixed(0) || '—'} / {hardware.drive.total} GB</span></div>
              <div className="info-row"><span className="info-row-key">RUL</span><span className="info-row-value" style={{ color:'var(--accent-purple)' }}>{hardware.drive.rul} months ({hardware.drive.rulPercent}%)</span></div>
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="empty-state">
              <RefreshCw size={48} />
              <h3>Awaiting Scan</h3>
              <p>Run a hardware scan to see real-time component metrics and RUL predictions here.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DetectPage;
