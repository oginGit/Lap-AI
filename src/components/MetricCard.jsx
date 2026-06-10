/**
 * MetricCard component
 * Redesigned to match the reference image: top badge, large value, subtext, and progress bar.
 */

const colorMap = {
  Good:     { bar: '#10b981', glow: 'rgba(16,185,129,0.2)',  badge: 'badge-good'    },
  Warning:  { bar: '#f59e0b', glow: 'rgba(245,158,11,0.2)', badge: 'badge-warning' },
  Critical: { bar: '#ef4444', glow: 'rgba(239,68,68,0.2)',   badge: 'badge-critical' },
};

const MetricCard = ({ type, data, loading }) => {
  const status = data?.status ?? 'Unknown';
  const colors = colorMap[status] ?? { bar: 'var(--border-light)', glow: 'transparent', badge: 'badge-info' };

  const renderContent = () => {
    let value = '--';
    let unit = '';
    let label = 'No Data';
    let subValue = '--';
    let subLabel = '';
    let rulValue = 'RUL: -- Months';
    let extraDetail = null;

    if (type === 'cpu') {
      value = data?.temperature?.toFixed(0) || '--';
      unit = '°C';
      label = data?.model || 'CPU Name';
      subValue = data?.usage?.toFixed(1) || '--';
      subLabel = 'Usage';
      rulValue = `RUL: ${data?.rul || '--'} Months`;
      extraDetail = data ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <div>
            {data.voltage != null && data.voltage > 0 ? `⚡ ${data.voltage.toFixed(2)}V` : ''}
            {data.voltage != null && data.voltage > 0 && data.fan_speed > 0 ? ' • ' : ''}
            {data.fan_speed > 0 ? `🔄 ${data.fan_speed.toFixed(0)} RPM` : ''}
            {(!data.voltage || data.voltage === 0) && (!data.fan_speed || data.fan_speed === 0) ? '⚡ Voltage: N/A • 🔄 Fan: N/A' : ''}
          </div>
          <div>🕒 {data.speed?.toFixed(2) || '--'} GHz {data.throttling ? <span style={{ color: 'var(--accent-red)', fontWeight: 'bold' }}>• THROTTLING</span> : ''}</div>
          <div style={{ color: 'var(--accent-blue)', fontSize: '10px', marginTop: '4px' }}>🎯 Predicted Junction: {data.predicted_temp || '--'}°C</div>
        </div>
      ) : null;
    } else if (type === 'battery') {
      value = data?.percent?.toFixed(0) || '--';
      unit = '%';
      label = data?.isCharging ? '🔌 Charging' : '🔋 On Battery';
      subValue = data?.health?.toFixed(0) || '--';
      subLabel = 'Health';
      rulValue = `RUL: ${data?.rul || '--'} Months`;
      extraDetail = data ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <div>{data.voltage != null ? `${data.voltage.toFixed(1)}V` : '--V'} • {data.cycles != null && data.cycles > 0 ? `${data.cycles} Cycles` : 'Cycles: N/A'}</div>
          {data.dischargeRate > 0 && !data.isCharging && (
            <div style={{ color: 'var(--accent-yellow)', fontSize: '10px' }}>⚡ Discharge Rate: {data.dischargeRate.toFixed(1)}%/hr</div>
          )}
        </div>
      ) : null;
    } else if (type === 'drive') {
      const driveType = (data?.type || 'SSD').toUpperCase();
      const isSSD = driveType.includes('SSD') || driveType.includes('NVME');
      value = data?.health?.toFixed(0) || '--';
      unit = '%';
      label = data?.model || 'Drive Name';
      const used = data?.used?.toFixed(1) || '--';
      const total = data?.total?.toFixed(0) || '--';
      subValue = `${used} / ${total} GB`;
      subLabel = 'Storage Used';
      rulValue = `RUL: ${data?.rul || '--'} Months`;
      extraDetail = data ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <div>🌡️ {data.temperature || '--'}°C • 💾 {data.type || 'SSD'}</div>
          {isSSD ? (
            <>
              <div>🔋 Wear Level: <span style={{ color: (data.wearLevel ?? data.wear_level ?? 100) < 30 ? 'var(--accent-red)' : 'var(--accent-green)', fontWeight: '600' }}>{data.wearLevel ?? data.wear_level ?? '--'}%</span></div>
              {(data.powerOnHours ?? data.power_on_hours) > 0 && (
                <div>⏱️ Power On: {((data.powerOnHours ?? data.power_on_hours) / 24).toFixed(0)} days</div>
              )}
              {(data.reallocatedSectors ?? data.reallocated_sectors ?? 0) > 0 && (
                <div style={{ color: 'var(--accent-red)' }}>⚠️ Reallocated Sectors: {data.reallocatedSectors ?? data.reallocated_sectors}</div>
              )}
            </>
          ) : (
            <>
              <div>⚠️ Reallocated Sectors: <span style={{ color: (data.reallocatedSectors ?? data.reallocated_sectors ?? 0) > 0 ? 'var(--accent-red)' : 'var(--text-primary)', fontWeight: (data.reallocatedSectors ?? data.reallocated_sectors ?? 0) > 0 ? 'bold' : 'normal' }}>{data.reallocatedSectors ?? data.reallocated_sectors ?? 0}</span></div>
              {(data.pendingSectors ?? data.pending_sectors ?? 0) > 0 && <div style={{ color: 'var(--accent-red)' }}>⚠️ Pending Sectors: {data.pendingSectors ?? data.pending_sectors}</div>}
              {(data.spinRetryCount ?? data.spin_retry_count ?? 0) > 0 && <div style={{ color: 'var(--accent-red)' }}>🔄 Spin Retries: {data.spinRetryCount ?? data.spin_retry_count}</div>}
              {(data.powerOnHours ?? data.power_on_hours) > 0 && (
                <div>⏱️ Power On: {((data.powerOnHours ?? data.power_on_hours) / 24).toFixed(0)} days</div>
              )}
            </>
          )}
        </div>
      ) : null;
    }

    return (
      <div style={{ position: 'relative', height: '100%' }}>
        {/* Top Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '18px' }}>{type === 'cpu' ? '📟' : type === 'battery' ? '⚡' : '🗄️'}</span>
            <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', textTransform: 'uppercase' }}>
              {type === 'drive' ? (data?.type || 'STORAGE') : type.toUpperCase()}
            </span>
          </div>
          {data && (
            <span className={`metric-badge ${colors.badge}`} style={{ background: 'rgba(16,185,129,0.1)', color: colors.bar, border: 'none', borderRadius: '4px', fontSize: '10px' }}>
              {status}
            </span>
          )}
        </div>

        {/* Main Value */}
        <div style={{ marginBottom: 15 }}>
          <div style={{ fontSize: '32px', fontWeight: '800', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {value}{unit}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={label}>
            {label}
          </div>
        </div>

        {/* Progress Bar Area */}
        <div style={{ marginTop: 'auto' }}>
          <div className="progress-bar-bg" style={{ height: '4px', background: 'var(--border-light)' }}>
            <div
              className="progress-bar-fill"
              style={{
                width: `${data?.rulPercent || 0}%`,
                background: colors.bar,
                height: '100%',
                boxShadow: `0 0 10px ${colors.glow}`
              }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: '11px' }}>
            <span style={{ color: 'var(--text-muted)' }}>{subLabel}</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{subValue}{type === 'cpu' && data ? '%' : ''}</span>
          </div>
          {extraDetail && (
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: 4 }}>
              {extraDetail}
            </div>
          )}
          <div style={{ fontSize: '11px', color: 'var(--accent-purple)', fontWeight: '600', marginTop: 4 }}>
            {rulValue}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`card metric-card ${type}`}>
      {loading ? (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div style={{ height: 20, width: '40%', background:'var(--border-light)', borderRadius:4 }} className="skeleton-line" />
          <div style={{ height: 40, width: '70%', background:'var(--border-light)', borderRadius:4 }} className="skeleton-line" />
          <div style={{ height: 4, width: '100%', background:'var(--border-light)', borderRadius:4, marginTop: 10 }} className="skeleton-line" />
        </div>
      ) : renderContent()}
    </div>
  );
};

export default MetricCard;


