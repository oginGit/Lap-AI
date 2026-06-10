/**
 * HealthRing — SVG circular health score gauge
 */

const HealthRing = ({ score = 0, size = 160, strokeWidth = 12 }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (score / 100) * circumference;

  const color = score >= 80 ? '#3fb950' : score >= 60 ? '#d29922' : '#ff7b72';
  const label = score >= 80 ? 'Excellent' : score >= 60 ? 'Moderate' : 'Critical';

  return (
    <div className="health-ring-container">
      <div style={{ position: 'relative', width: size, height: size }}>
        {/* Background SVG */}
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          {/* Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth={strokeWidth}
          />
          {/* Progress */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            style={{
              transition: 'stroke-dashoffset 1.5s cubic-bezier(0.4, 0, 0.2, 1)',
              filter: `drop-shadow(0 0 6px ${color}88)`,
            }}
          />
        </svg>

        {/* Center Text */}
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <span style={{
            fontSize: 32,
            fontWeight: 800,
            color,
            fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: '-2px',
            lineHeight: 1,
          }}>{score}</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>/100</span>
        </div>
      </div>

      <div className="health-ring-label" style={{ color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600 }}>
        Overall Health — <span style={{ color }}>{label}</span>
      </div>
    </div>
  );
};

export default HealthRing;
