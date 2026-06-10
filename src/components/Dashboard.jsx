/**
 * Dashboard — Main overview page
 * Shows real-time hardware health, component metric cards, 6-month prediction charts,
 * and overall system health score — all connected to the real Python backend.
 * Automatically saves every scan to the user's history database.
 */
import { useState, useEffect } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  Tooltip, CartesianGrid,
} from 'recharts';

import { Cpu, Zap, HardDrive, Activity, RefreshCw, AlertTriangle, CheckCircle, Wifi, WifiOff, MessageSquare, Bell, Brain, Sun, Moon, RotateCcw } from 'lucide-react';
import MetricCard from './MetricCard';
import HealthRing from './HealthRing';
import { fetchHardwareStatus, checkBackendHealth, saveReport } from '../utils/api';

// Custom tooltip for charts
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-accent)',
      borderRadius: 8,
      padding: '10px 14px',
      fontSize: 12,
    }}>
      <div style={{ color: 'var(--text-secondary)', marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, fontWeight: 600 }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed(1) : p.value}
          {p.unit ?? ''}
        </div>
      ))}
    </div>
  );
};

const Dashboard = ({ hardware, setHardware, llmAnalysis, setLlmAnalysis, toast, setActivePage, theme, toggleTheme }) => {

  const [detecting, setDetecting] = useState(false);
  const [backendOnline, setBackendOnline] = useState(null);


  // Check backend status on mount
  useEffect(() => {
    checkBackendHealth().then(r => setBackendOnline(r.online));
  }, []);


  const handleDetect = async (silent = false) => {
    setDetecting(true);
    try {
      const data = await fetchHardwareStatus();
      setHardware(data);
      if (!silent) toast?.success('Hardware status detected successfully!');
      setBackendOnline(true);

      // Auto-save the scan to the user's history database
      try {
        const overallHealth = data.overallHealth || 0;
        const priority = overallHealth < 50 ? 'Urgent' : overallHealth < 70 ? 'Moderate' : 'Low';
        await saveReport({
          cpu: data.cpu,
          battery: data.battery,
          drive: data.drive,
          overallHealth,
          overallRUL: data.overallRUL,
          priority,
          timestamp: data.timestamp,
          date: new Date().toISOString(),
        });
        if (!silent) toast?.info('📝 Scan saved to history');
      } catch (saveErr) {
        console.warn('Auto-save to history failed:', saveErr);
      }
    } catch (e) {
      if (!silent) toast?.error(`Failed: ${e.message}`);
      setBackendOnline(false);
    } finally {
      setDetecting(false);
    }
  };

  // Build radar data from hardware
  const radarData = hardware ? [
    { subject: 'CPU',     value: hardware.cpu.rulPercent,     fullMark: 100 },
    { subject: 'Battery', value: hardware.battery.rulPercent, fullMark: 100 },
    { subject: 'Storage', value: hardware.drive.rulPercent,   fullMark: 100 },
    { subject: 'Thermal', value: Math.max(0, 100 - (hardware.cpu.temperature || 50)), fullMark: 100 },
    { subject: 'SMART',   value: hardware.drive.health,       fullMark: 100 },
  ] : [];

  // 6-month prediction timeline — use backend predictions if available
  const rulTimeline = hardware?.predictions || (hardware ? [
    { month: 'Now',    cpu: hardware.cpu.rulPercent,     battery: hardware.battery.rulPercent, drive: hardware.drive.rulPercent },
    { month: '+1mo',   cpu: Math.max(0, hardware.cpu.rulPercent - 4),  battery: Math.max(0, hardware.battery.rulPercent - 5),  drive: Math.max(0, hardware.drive.rulPercent - 2) },
    { month: '+2mo',   cpu: Math.max(0, hardware.cpu.rulPercent - 9),  battery: Math.max(0, hardware.battery.rulPercent - 11), drive: Math.max(0, hardware.drive.rulPercent - 4) },
    { month: '+3mo',   cpu: Math.max(0, hardware.cpu.rulPercent - 14), battery: Math.max(0, hardware.battery.rulPercent - 17), drive: Math.max(0, hardware.drive.rulPercent - 6) },
    { month: '+4mo',   cpu: Math.max(0, hardware.cpu.rulPercent - 20), battery: Math.max(0, hardware.battery.rulPercent - 23), drive: Math.max(0, hardware.drive.rulPercent - 8) },
    { month: '+5mo',   cpu: Math.max(0, hardware.cpu.rulPercent - 26), battery: Math.max(0, hardware.battery.rulPercent - 30), drive: Math.max(0, hardware.drive.rulPercent - 10) },
    { month: '+6mo',   cpu: Math.max(0, hardware.cpu.rulPercent - 33), battery: Math.max(0, hardware.battery.rulPercent - 38), drive: Math.max(0, hardware.drive.rulPercent - 12) },
  ] : []);

  // Build real-time alerts from actual hardware readings
  const alerts = hardware ? (() => {
    const a = [];

    // --- CPU Alerts ---
    const cpuTemp = hardware.cpu?.temperature;
    if (cpuTemp != null) {
      if (cpuTemp > 85) {
        a.push({ type: 'danger', icon: AlertTriangle, text: `CPU critically overheating at ${cpuTemp.toFixed(0)}°C — risk of thermal damage. Check cooling immediately.` });
      } else if (cpuTemp > 70) {
        a.push({ type: 'warning', icon: AlertTriangle, text: `CPU temperature elevated at ${cpuTemp.toFixed(0)}°C — clean vents and check airflow.` });
      }
    }
    if (hardware.cpu?.throttling) {
      a.push({ type: 'danger', icon: AlertTriangle, text: 'CPU is thermal throttling — performance is being capped to prevent damage.' });
    }
    // CPU risk factors from backend predictor
    (hardware.cpu?.risk_factors || []).forEach(rf => {
      if (!a.some(existing => existing.text.includes(rf.substring(0, 30)))) {
        a.push({ type: 'warning', icon: AlertTriangle, text: rf });
      }
    });

    // --- Battery Alerts ---
    const batHealth = hardware.battery?.health;
    const batPercent = hardware.battery?.percent;
    const batCharging = hardware.battery?.isCharging ?? hardware.battery?.is_charging;
    if (batHealth != null) {
      if (batHealth < 60) {
        a.push({ type: 'danger', icon: AlertTriangle, text: `Battery health critical at ${batHealth}% — replacement recommended soon.` });
      } else if (batHealth < 75) {
        a.push({ type: 'warning', icon: AlertTriangle, text: `Battery health degraded to ${batHealth}% — consider calibration or replacement.` });
      }
    }
    if (batPercent != null && batPercent < 20 && !batCharging) {
      a.push({ type: 'danger', icon: Zap, text: `Battery very low at ${batPercent.toFixed(0)}% and not charging — plug in your charger.` });
    }
    // Battery risk factors from backend predictor
    (hardware.battery?.risk_factors || []).forEach(rf => {
      if (!a.some(existing => existing.text.includes(rf.substring(0, 30)))) {
        a.push({ type: 'warning', icon: Zap, text: rf });
      }
    });

    // --- Drive Alerts ---
    const driveHealth = hardware.drive?.health;
    if (driveHealth != null) {
      if (driveHealth < 65) {
        a.push({ type: 'danger', icon: HardDrive, text: `Storage drive health critical at ${driveHealth}% — back up data immediately.` });
      } else if (driveHealth < 80) {
        a.push({ type: 'warning', icon: HardDrive, text: `Storage drive health declining at ${driveHealth}% — monitor closely.` });
      }
    }
    const realloc = hardware.drive?.reallocatedSectors ?? hardware.drive?.reallocated_sectors ?? 0;
    const pending = hardware.drive?.pendingSectors ?? hardware.drive?.pending_sectors ?? 0;
    if (realloc > 5) {
      a.push({ type: 'danger', icon: HardDrive, text: `${realloc} reallocated sectors detected — drive surface degradation, backup data now.` });
    } else if (realloc > 0) {
      a.push({ type: 'warning', icon: HardDrive, text: `${realloc} reallocated sector(s) detected — minor wear, monitor closely.` });
    }
    if (pending > 0) {
      a.push({ type: 'danger', icon: HardDrive, text: `${pending} pending sector(s) — data integrity at risk.` });
    }
    if (hardware.drive?.temperature > 55) {
      a.push({ type: 'warning', icon: HardDrive, text: `Storage drive temperature elevated at ${hardware.drive.temperature}°C.` });
    }
    // Drive risk factors from backend predictor
    (hardware.drive?.risk_factors || []).forEach(rf => {
      if (!a.some(existing => existing.text.includes(rf.substring(0, 30)))) {
        a.push({ type: 'warning', icon: HardDrive, text: rf });
      }
    });

    // --- AI Advisor results (if available) ---
    if (llmAnalysis?.issues) {
      llmAnalysis.issues.forEach(issue => {
        if (!a.some(existing => existing.text === issue)) {
          a.push({ type: 'warning', icon: Brain, text: issue });
        }
      });
    }

    // --- Success message if no issues ---
    if (a.length === 0) {
      if (llmAnalysis && llmAnalysis.priority === 'Low') {
        a.push({ type: 'success', icon: CheckCircle, text: 'AI Analysis: Your system is in good shape.' });
      } else {
        a.push({ type: 'success', icon: CheckCircle, text: 'All systems performing optimally. No action needed.' });
      }
    }

    return a;
  })() : [];


  return (
    <div className="fade-in">
      {/* Top bar */}
      <div className="topbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', paddingBottom: '0', borderBottom: 'none' }}>
        <div className="topbar-title">
          <h2 style={{ fontSize: '28px', fontWeight: '800', letterSpacing: '-0.5px' }}>Overview</h2>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          {/* Theme Toggle */}
          <button 
            className="btn-icon-round"
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            style={{ 
              background: 'var(--border-light)', 
              border: '1px solid var(--border-light)',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-purple)',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          {/* Backend Status */}
          <div style={{ fontSize: '12px', color: backendOnline ? 'var(--accent-green)' : 'var(--accent-red)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: backendOnline ? 'var(--accent-green)' : 'var(--accent-red)', boxShadow: backendOnline ? '0 0 8px var(--accent-green)' : 'none' }} />
            {backendOnline ? 'Live' : 'Offline'}
          </div>

          {hardware && (
            <button
              className="btn btn-secondary btn-lg"
              onClick={() => {
                setHardware(null);
                setLlmAnalysis(null);
                toast?.success('Dashboard reset to default view.');
              }}
              style={{
                borderRadius: '12px',
                padding: '10px 20px',
                background: 'rgba(239, 68, 68, 0.1)',
                borderColor: 'rgba(239, 68, 68, 0.2)',
                color: 'var(--accent-red)',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
              id="reset-dashboard-btn"
            >
              <RotateCcw size={16} /> Reset Scan
            </button>
          )}

          <button
            className={`btn btn-primary btn-lg ${detecting ? 'disabled' : ''}`}
            onClick={() => handleDetect(false)}
            disabled={detecting}
            id="detect-hardware-btn"
            style={{ 
              borderRadius: '12px', 
              padding: '10px 20px', 
              background: 'var(--accent-purple)', 
              borderColor: 'var(--accent-purple)',
              boxShadow: '0 0 15px rgba(139, 92, 246, 0.3)'
            }}
          >
            {detecting ? (
              <><div className="spinner" /> Scanning...</>
            ) : (
              <><RefreshCw size={16} /> Detect Hardware Status</>
            )}
          </button>
        </div>
      </div>



      {/* Metric Cards Grid - 4 Columns */}
      <div className="metrics-grid">
        {/* Overall Health Card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
          <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>Overall Health</div>
          <div style={{ display: 'flex', justifyContent: 'center', margin: '10px 0' }}>
            <HealthRing score={hardware?.overallHealth || 0} size={120} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-green)', fontWeight: '700', fontSize: '14px' }}>
              <CheckCircle size={16} /> {hardware?.overallHealth >= 80 ? 'Optimal' : hardware?.overallHealth >= 60 ? 'Good' : 'Critical'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 4 }}>
              Your laptop is in {hardware?.overallHealth >= 80 ? 'excellent' : hardware?.overallHealth >= 60 ? 'fair' : 'poor'} health.
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: 10, fontSize: '11px', color: 'var(--text-muted)' }}>
            <span>🌡️ {hardware?.cpu?.temperature?.toFixed(0) || '--'}°C</span>
            <span>🛡️ Low Risk</span>
            <span>🕒 {hardware ? new Date(hardware.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</span>
          </div>
        </div>

        <MetricCard type="cpu"     data={hardware?.cpu}     loading={detecting} />
        <MetricCard type="battery" data={hardware?.battery} loading={detecting} />
        <MetricCard type="drive"   data={hardware?.drive}   loading={detecting} />
      </div>

      {/* Main Dashboard Grid - AI Forecast & Insights */}
      <div className="dashboard-main-grid">
        {/* 6-Month Predictive Forecast - Spans 2 cols */}
        <div className="card grid-col-span-2">
          <div className="card-header">
            <div className="card-title">
              <div className="card-icon" style={{ background: 'rgba(139, 92, 246, 0.1)' }}>
                <Activity size={18} color="var(--accent-purple)" />
              </div>
              <h3>6-Month Predictive Forecast</h3>
            </div>
            <span className="metric-badge badge-info">AI Forecast</span>
          </div>

            <div className="chart-container" style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={rulTimeline}>
                  <defs>
                    <linearGradient id="purpleGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="var(--accent-purple)" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="var(--accent-purple)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                  <XAxis 
                    dataKey="month" 
                    tick={{ fill: 'var(--text-muted)', fontSize: 11 }} 
                    axisLine={false} 
                    tickLine={false} 
                    dy={10}
                  />
                  <YAxis 
                    domain={[0, 100]} 
                    tick={{ fill: 'var(--text-muted)', fontSize: 11 }} 
                    axisLine={false} 
                    tickLine={false} 
                    unit="%" 
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Area 
                    type="monotone" 
                    dataKey="cpu" 
                    name="System Health" 
                    stroke="var(--accent-purple)" 
                    fill="url(#purpleGrad)" 
                    strokeWidth={3} 
                    dot={{ fill: 'var(--accent-purple)', r: 4, strokeWidth: 2, stroke: 'var(--bg-card)' }}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

        </div>

        {/* AI Insights Card - Spans 1 col */}
        <div className="card grid-col-span-1">
          <div className="card-header">
            <div className="card-title">
              <div className="card-icon" style={{ background: 'rgba(139, 92, 246, 0.1)' }}>
                <Zap size={18} color="var(--accent-purple)" />
              </div>
              <h3>AI Insights</h3>
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{llmAnalysis ? 'AI Predicted Lifespan' : 'Est. Lifespan'}</div>
            <div style={{ fontSize: '32px', fontWeight: '800', color: 'var(--accent-green)', margin: '8px 0' }}>
              {llmAnalysis ? `${llmAnalysis.estimatedLifespan} Years` : hardware ? `${(hardware.overallRUL / 12).toFixed(1)} Years` : '-- Years'}
            </div>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', fontStyle: 'italic', margin: '20px 0', lineHeight: '1.6' }}>
              {llmAnalysis 
                ? `"${llmAnalysis.summary}"`
                : hardware 
                ? `"Based on current wear patterns, your ${hardware.battery.health < 80 ? 'battery is degrading' : 'system health is stable'}. ${hardware.cpu.temperature > 75 ? 'Recommended to check thermal paste.' : 'Thermals are optimal.'}"`
                : '"No hardware data available for analysis. Run detection to see AI insights."'}
            </p>
            {llmAnalysis && (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: 15, display: 'flex', alignItems: 'center', gap: 5 }}>
                <Activity size={12} /> Analysis from {new Date(llmAnalysis.analysedAt).toLocaleDateString()}
              </div>
            )}
            <button className="btn btn-secondary" style={{ width: '100%', marginTop: 10 }} onClick={() => setActivePage('advisor')}>
              {llmAnalysis ? 'View Detailed Advice' : 'Get AI Advice'}
            </button>
          </div>
        </div>

        {/* AI Advisor Alerts Card - Spans 1 col */}
        <div className="card grid-col-span-1">
          <div className="card-header">
            <div className="card-title">
              <div className="card-icon" style={{ background: 'rgba(239, 68, 68, 0.1)' }}>
                <AlertTriangle size={18} color="var(--accent-red)" />
              </div>
              <h3>AI Advisor Alerts</h3>
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            {alerts.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {alerts.map((a, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, fontSize: '13px', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <a.icon size={18} color={a.type === 'danger' ? 'var(--accent-red)' : a.type === 'success' ? 'var(--accent-green)' : 'var(--accent-yellow)'} style={{ flexShrink: 0, marginTop: 2 }} />
                    <span style={{ color: 'var(--text-secondary)' }}>{a.text}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
                <CheckCircle size={40} style={{ marginBottom: 15, opacity: 0.3, color: 'var(--accent-green)' }} />
                <p>{hardware ? 'No critical hardware issues detected.' : 'Detect hardware to see alerts.'}</p>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
};

export default Dashboard;
