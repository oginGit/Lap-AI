/**
 * mockBackend.js
 * Simulates backend API calls for hardware status detection and LLM analysis.
 * Replace these functions with real API calls when your backend is ready.
 *
 * Backend Integration Points:
 *   - fetchHardwareStatus() → GET /api/hardware/status
 *   - sendToLLM()          → POST /api/llm/analyze  (Google Gemini / Grok / Claude)
 *   - fetchHistory()       → GET /api/reports/history
 *   - saveReport()         → POST /api/reports/save
 */

// ---------------------------------------------------------------------------
// Helper: random float between min and max
// ---------------------------------------------------------------------------
const rand = (min, max, decimals = 1) =>
  parseFloat((Math.random() * (max - min) + min).toFixed(decimals));

// ---------------------------------------------------------------------------
// fetchHardwareStatus
// Simulates fetching CPU temperature, battery health, and HDD SMART data.
// In production: GET /api/hardware/status
// ---------------------------------------------------------------------------
export const fetchHardwareStatus = async () => {
  // Simulate a network round-trip delay (600 ms – 1.4 s)
  await new Promise(r => setTimeout(r, 800 + Math.random() * 600));

  const cpuTemp = rand(45, 95);
  const cpuUsage = rand(20, 90);
  const batteryPercent = rand(20, 100);
  const batteryHealth = rand(55, 100);
  const driveHealth = rand(60, 100);
  const driveTemp = rand(30, 55);

  // --- RUL calculations (rule-based heuristics) ---
  // CPU RUL (months): higher temp → lower RUL
  const cpuRUL = Math.round(Math.max(3, 36 - (cpuTemp - 45) * 0.5));

  // Battery RUL (months): based on battery health
  const batteryRUL = Math.round(Math.max(1, (batteryHealth / 100) * 24));

  // Drive RUL (months): based on SMART health percentage
  const driveRUL = Math.round(Math.max(2, (driveHealth / 100) * 48));

  // Overall health score (0-100)
  const overallHealth = Math.round((cpuRUL / 36) * 33 + (batteryRUL / 24) * 33 + (driveRUL / 48) * 34);

  const getStatus = (value, thresholds) => {
    if (value >= thresholds[0]) return 'Good';
    if (value >= thresholds[1]) return 'Warning';
    return 'Critical';
  };

  return {
    timestamp: new Date().toISOString(),
    cpu: {
      temperature: cpuTemp,
      usage: cpuUsage,
      cores: 8,
      speed: rand(2.4, 4.8),
      status: getStatus(100 - cpuTemp, [40, 20]),
      rul: cpuRUL,
      rulPercent: Math.round((cpuRUL / 36) * 100),
      model: 'Intel Core i7-12th Gen',
    },
    battery: {
      percent: batteryPercent,
      health: batteryHealth,
      capacity: rand(40, 80),
      cycles: Math.round(rand(50, 900)),
      status: getStatus(batteryHealth, [80, 60]),
      rul: batteryRUL,
      rulPercent: Math.round((batteryRUL / 24) * 100),
      voltage: rand(10.8, 12.6),
    },
    drive: {
      health: driveHealth,
      temperature: driveTemp,
      used: rand(30, 90),
      total: 512,
      reallocatedSectors: Math.round(rand(0, 15)),
      status: getStatus(driveHealth, [80, 65]),
      rul: driveRUL,
      rulPercent: Math.round((driveRUL / 48) * 100),
      type: 'SSD NVMe',
      model: 'Samsung 980 Pro 512GB',
    },
    overallHealth,
    overallRUL: Math.round((cpuRUL + batteryRUL + driveRUL) / 3),
  };
};

// ---------------------------------------------------------------------------
// sendToLLM
// Sends hardware metrics and user responses to the LLM for analysis.
// In production: POST /api/llm/analyze
// Payload: { hardware, userResponses }
// ---------------------------------------------------------------------------
export const sendToLLM = async (hardware, userResponses) => {
  // Simulate LLM processing delay (1.5 s – 2.5 s)
  await new Promise(r => setTimeout(r, 1500 + Math.random() * 1000));

  const { cpu, battery, drive, overallHealth } = hardware;

  // Build contextual advice based on actual values
  const issues = [];
  const actions = [];
  let lifespan = 0;

  // CPU analysis
  if (cpu.temperature > 85) {
    issues.push('CPU is running at critically high temperatures (>85°C).');
    actions.push('Apply new thermal paste and clean the cooling system immediately.');
    actions.push('Consider undervolting the CPU to reduce heat output.');
  } else if (cpu.temperature > 70) {
    issues.push('CPU temperature is elevated. Check cooling.');
    actions.push('Clean laptop vents and ensure airflow is not obstructed.');
  }

  // Battery analysis
  if (userResponses.batteryDrain === 'yes' || battery.health < 70) {
    issues.push(`Battery health is at ${battery.health.toFixed(0)}% with rapid drain reported.`);
    actions.push('Calibrate the battery: fully charge, then fully discharge once a month.');
    actions.push('Avoid leaving the laptop plugged in at 100% for extended periods.');
    if (battery.health < 60) {
      actions.push('Battery replacement is strongly recommended within 3–6 months.');
    }
  }

  // Drive analysis
  if (drive.reallocatedSectors > 5) {
    issues.push(`Hard drive has ${drive.reallocatedSectors} reallocated sectors — early signs of failure.`);
    actions.push('Back up all important data immediately to an external drive or cloud.');
    actions.push('Schedule a full disk diagnostic (CrystalDiskInfo or similar tool).');
  }

  // Physical damage
  if (userResponses.dropped === 'yes') {
    issues.push('Physical drop detected. Internal components may have micro-fractures.');
    actions.push('Have a technician inspect the motherboard and HDD for physical damage.');
  }

  // Noise / overheating
  if (userResponses.noisesOrHeating === 'yes') {
    issues.push('Unusual noises or excessive heating reported — possible fan or HDD failure.');
    actions.push('Run a hardware diagnostic tool to check fan RPM and HDD SMART data.');
    actions.push('Consider replacing the cooling fan if it makes grinding noises.');
  }

  // Estimate lifespan
  lifespan = overallHealth >= 80 ? rand(3, 5) :
             overallHealth >= 60 ? rand(1.5, 3) :
             overallHealth >= 40 ? rand(0.5, 1.5) : rand(0.1, 0.5);

  const overallAdvice = overallHealth >= 80
    ? 'Your laptop is in excellent health. Continue regular maintenance and monitor temperatures.'
    : overallHealth >= 60
    ? 'Your laptop is in moderate condition. Address the identified issues to extend its lifespan.'
    : 'Your laptop requires urgent attention. Multiple components are showing signs of stress or failure.';

  if (actions.length === 0) {
    actions.push('Continue regular cleaning and software maintenance.');
    actions.push('Keep drivers and OS up to date for optimal performance.');
    actions.push('Monitor temperatures during intensive tasks.');
  }

  return {
    summary: overallAdvice,
    issues: issues.length > 0 ? issues : ['No critical issues detected at this time.'],
    actions,
    estimatedLifespan: parseFloat(lifespan.toFixed(1)),
    efficiency: overallHealth,
    priority: overallHealth < 50 ? 'Urgent' : overallHealth < 70 ? 'Moderate' : 'Low',
    analysedAt: new Date().toISOString(),
    model: 'Gemini-1.5-Pro (Hardware Advisor)',
  };
};

// ---------------------------------------------------------------------------
// fetchHistory
// Returns saved historical reports.
// In production: GET /api/reports/history
// ---------------------------------------------------------------------------
export const fetchHistory = async () => {
  await new Promise(r => setTimeout(r, 400));

  // Return from localStorage first
  const stored = localStorage.getItem('laptop_health_history');
  if (stored) {
    try { return JSON.parse(stored); } catch { /* ignore */ }
  }

  // Seed with demo data
  const demoData = [
    {
      id: '1',
      date: new Date(Date.now() - 7 * 86400000).toISOString(),
      overallHealth: 82,
      cpu: { temperature: 68, rul: 28, status: 'Good' },
      battery: { health: 85, rul: 18, status: 'Good' },
      drive: { health: 91, rul: 38, status: 'Good' },
      advice: 'Laptop is in good health. Perform regular cleaning every 3 months.',
      priority: 'Low',
    },
    {
      id: '2',
      date: new Date(Date.now() - 14 * 86400000).toISOString(),
      overallHealth: 71,
      cpu: { temperature: 79, rul: 22, status: 'Warning' },
      battery: { health: 74, rul: 14, status: 'Warning' },
      drive: { health: 88, rul: 36, status: 'Good' },
      advice: 'CPU running warm. Clean vents and reapply thermal paste.',
      priority: 'Moderate',
    },
    {
      id: '3',
      date: new Date(Date.now() - 30 * 86400000).toISOString(),
      overallHealth: 55,
      cpu: { temperature: 91, rul: 8, status: 'Critical' },
      battery: { health: 58, rul: 9, status: 'Critical' },
      drive: { health: 72, rul: 24, status: 'Warning' },
      advice: 'Critical: Replace thermal paste and battery. Schedule maintenance.',
      priority: 'Urgent',
    },
  ];
  localStorage.setItem('laptop_health_history', JSON.stringify(demoData));
  return demoData;
};

// ---------------------------------------------------------------------------
// saveReport
// Saves a report entry to localStorage (mock persistence).
// In production: POST /api/reports/save
// ---------------------------------------------------------------------------
export const saveReport = async (report) => {
  await new Promise(r => setTimeout(r, 200));
  const stored = localStorage.getItem('laptop_health_history');
  const history = stored ? JSON.parse(stored) : [];
  const newEntry = { id: Date.now().toString(), ...report };
  history.unshift(newEntry);
  localStorage.setItem('laptop_health_history', JSON.stringify(history.slice(0, 50)));
  return newEntry;
};
