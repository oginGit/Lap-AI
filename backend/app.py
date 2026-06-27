"""
app.py — Production-Ready Flask Backend for LaptopMD
Optimized for thread-safety, performance, and robust AI diagnostics.
"""

import sys
import io
import os
import time
import datetime
import threading
import logging
import signal
import re
import json
from flask import Flask, jsonify, request
from flask_cors import CORS

# --- Imports from local modules ---
from hardware_monitor import HardwareMonitor
from health_predictor import HealthPredictor
from chatbot_service import chat as chatbot_chat
from transcription_service import transcribe_audio

# --- Configure Encoding & Logging ---
if sys.stdout is None:
    sys.stdout = open(os.devnull, 'w')
elif getattr(sys.stdout, 'encoding', None) != "utf-8":
    try:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    except AttributeError:
        pass

if sys.stderr is None:
    sys.stderr = open(os.devnull, 'w')
elif getattr(sys.stderr, 'encoding', None) != "utf-8":
    try:
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")
    except AttributeError:
        pass

# Set up log file path in the executable's directory
if getattr(sys, 'frozen', False):
    log_dir = os.path.dirname(sys.executable)
else:
    log_dir = os.path.dirname(os.path.abspath(__file__))
log_file = os.path.join(log_dir, "lapguard_agent.log")

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler(log_file, encoding='utf-8'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("LaptopMDBase")

# --- Flask App Setup ---
app = Flask(__name__)
CORS(app, origins="*")

# --- Global State & Thread Safety ---
state_lock = threading.Lock()

# Provide a valid warmup structure so frontend never sees None/Null
WARMUP_DATA = {
    "timestamp": datetime.datetime.now().isoformat(),
    "cpu": {"temperature": 40.0, "usage": 10.0, "cores": 4, "speed": 2.4, "model": "Scanning...", "status": "Good", "rul": 60, "rulPercent": 100, "healthScore": 100, "temp_trend": [40]*20, "usage_trend": [10]*20},
    "battery": {
        "percent": 100.0, "is_charging": False, "isCharging": False, "health": 100, "status": "Good", 
        "rul": 36, "rulPercent": 100, "capacity": 50000, "currentCapacity": 50000, "cycles": 0, "cycle_count": 0, 
        "voltage": 11.4, "temperature": 30.0, "discharge_rate": 0.0, "dischargeRate": 0.0
    },
    "drive": {
        "total_gb": 512.0, "used_gb": 100.0, "total": 512.0, "used": 100.0, 
        "totalGb": 512.0, "usedGb": 100.0, "temperature": 35.0, "health": 100, "status": "Good", 
        "rul": 60, "rulPercent": 100, "type": "SSD", "model": "Scanning...",
        "power_on_hours": 1000, "powerOnHours": 1000,
        "reallocated_sectors": 0, "reallocatedSectors": 0,
        "pending_sectors": 0, "pendingSectors": 0,
        "spin_retry_count": 0, "spinRetryCount": 0
    },
    "overallHealth": 100,
    "overallRUL": 36,
    "predictions": [{"month": "Now", "cpu": 100, "battery": 100, "drive": 100, "overall": 100}]
}
current_hardware_data = WARMUP_DATA
scan_history = []
is_shutting_down = False

monitor = HardwareMonitor()
predictor = HealthPredictor()

# --- Background Monitoring Service ---
class MonitoringService:
    def __init__(self, interval=3):
        self.interval = interval
        self.thread = None

    def start(self):
        self.thread = threading.Thread(target=self._run, daemon=True)
        self.thread.start()
        logger.info(f"Background monitoring service started (Interval: {self.interval}s)")

    def _run(self):
        global current_hardware_data
        while not is_shutting_down:
            try:
                # 1. Gather Telemetry
                cpu_data = monitor.get_cpu_info()
                bat_data = monitor.get_battery_info()
                drv_data = monitor.get_drive_info()

                # 2. Predict Health
                cpu_h = predictor.calculate_cpu_health(cpu_data)
                bat_h = predictor.calculate_battery_health(bat_data)
                drv_h = predictor.calculate_drive_health(drv_data)

                # 3. Aggregate
                overall = round(cpu_h["score"] * 0.30 + bat_h["score"] * 0.35 + drv_h["score"] * 0.35)
                forecast = predictor.predict_6_months(cpu_h, bat_h, drv_h)

                new_data = {
                    "timestamp": datetime.datetime.now().isoformat(),
                    "cpu": {**cpu_data, "status": cpu_h["status"], "rul": cpu_h["rul_months"], "rulPercent": cpu_h["rul_percent"], "healthScore": cpu_h["score"], "risk_factors": cpu_h.get("risk_factors", [])},
                    "battery": {**bat_data, "health": bat_h["score"], "status": bat_h["status"], "rul": bat_h["rul_months"], "rulPercent": bat_h["rul_percent"], "risk_factors": bat_h.get("risk_factors", [])},
                    "drive": {**drv_data, "health": drv_h["score"], "status": drv_h["status"], "rul": drv_h["rul_months"], "rulPercent": drv_h["rul_percent"], "risk_factors": drv_h.get("risk_factors", [])},
                    "overallHealth": overall,
                    "overallRUL": min(cpu_h["rul_months"], bat_h["rul_months"], drv_h["rul_months"]),
                    "predictions": forecast
                }

                # 4. Safe Write
                with state_lock:
                    current_hardware_data = new_data
            except Exception as e:
                logger.error(f"Monitoring Loop Error: {e}")
            
            time.sleep(self.interval)

# Initialize and start service
monitor_service = MonitoringService(interval=3)
monitor_service.start()

# --- API Endpoints ---

@app.route("/api/health", methods=["GET"])
def health_check():
    return jsonify({"status": "online", "engine": "Sentinel v4.0", "time": datetime.datetime.now().isoformat()})

@app.route("/api/hardware/status", methods=["GET"])
def get_hardware_status():
    with state_lock:
        # Always returns a valid structure, even if just WARMUP
        return jsonify(current_hardware_data)

def run_fallback_rules(hardware, user_responses):
    """Deterministic system diagnostics when the AI endpoint is offline."""
    # Robust components fallback
    cpu_data = hardware.get("cpu") or {}
    battery_data = hardware.get("battery") or {}
    drive_data = hardware.get("drive") or {}
    
    cpu_temp = cpu_data.get("temperature", 50)
    cpu_usage = cpu_data.get("usage", 10)
    battery_health = battery_data.get("health", 100)
    drive_health = drive_data.get("health", 100)
    overall_health = hardware.get("overallHealth", 100)
    
    # Extract symptoms from new frontend structure or fall back to old keys
    issue = user_responses.get("issue", "").lower()
    issue_other = user_responses.get("issueOther", "").lower()
    
    battery_drain = (
        user_responses.get("batteryDrain") == "yes" or 
        "battery" in issue or 
        "drain" in issue_other or 
        "battery" in issue_other
    )
    
    slower_performance = (
        user_responses.get("slowerPerformance") == "yes" or 
        issue == "slow" or 
        "slow" in issue_other or 
        "lag" in issue_other or 
        "freeze" in issue_other
    )
    
    noises_or_heating = (
        user_responses.get("noisesOrHeating") == "yes" or 
        issue in ["overheating", "noise"] or 
        "heat" in issue_other or 
        "hot" in issue_other or 
        "noise" in issue_other or 
        "fan" in issue_other
    )
    
    unexpected_shutdown = (
        user_responses.get("unexpectedShutdown") == "yes" or 
        issue == "shutdown" or 
        "shutdown" in issue_other or 
        "restart" in issue_other or 
        "turn off" in issue_other
    )
    
    likely_causes = []
    recommended_actions = []
    
    # 1. Thermals and Fans
    if cpu_temp > 80 or noises_or_heating:
        likely_causes.append("Thermal throttling or inadequate cooling dust build-up")
        recommended_actions.extend([
            "Ensure the laptop is placed on a hard, flat surface to optimize airflow.",
            "Clean the exhaust vents using compressed air.",
            "Close resource-heavy applications in Task Manager."
        ])
        category = "Thermal"
        severity = "High" if cpu_temp > 85 or unexpected_shutdown else "Moderate"
    
    # 2. Battery Issues
    elif battery_health < 60 or battery_drain:
        likely_causes.append("Battery capacity degradation over multiple charge cycles")
        recommended_actions.extend([
            "Reduce screen brightness and use Power Saver mode.",
            "Calibrate the battery by discharging to 5% and charging to 100% uninterrupted.",
            "Check for battery-draining startup applications."
        ])
        category = "Battery"
        severity = "High" if battery_health < 50 else "Moderate"
        if battery_health < 60:
            recommended_actions.append("Consider purchasing a replacement battery soon.")
            
    # 3. Performance / Workloads
    elif cpu_usage > 75 or slower_performance:
        likely_causes.append("High CPU utilization or background app overhead")
        recommended_actions.extend([
            "Disable unnecessary startup applications.",
            "Perform a malware scan.",
            "Clear browser cache and temporary files."
        ])
        category = "Performance"
        severity = "Moderate"
        
    # 4. Storage Issues
    elif drive_health < 80:
        likely_causes.append("Drive storage sector wear or low drive health")
        recommended_actions.extend([
            "Backup critical data immediately.",
            "Run checkdisk utility (chkdsk) to repair system files.",
            "Monitor SSD/HDD health score regularly."
        ])
        category = "Hardware"
        severity = "High" if drive_health < 50 else "Moderate"
        
    # 5. Fallback Default
    else:
        category = "Mixed"
        severity = "Low"
        likely_causes.append("Background system tasks or minor performance fluctuations")
        recommended_actions.append("Ensure the operating system and device drivers are fully updated.")
        
    if unexpected_shutdown:
        severity = "Critical"
        likely_causes.append("Unexpected thermal/power shutdowns protecting hardware components")
        recommended_actions.extend([
            "Perform a hard reset and inspect the motherboard power rail.",
            "Monitor CPU packaging temperature and load closely."
        ])
    
    # Format according to 4-line summary output rules:
    # Condition: <Current system condition (simple)>
    # Root cause: <Main issue explanation (root cause)>
    # Impact: <Impact on user experience>
    # Recommendation: <Short recommendation direction>
    condition_map = {
        "Critical": "Critical system warnings detected with sudden power loss risk",
        "High": "Degraded hardware components impacting stability",
        "Moderate": "Sub-optimal system parameters detected",
        "Low": "Normal laptop condition with mild background load"
    }
    
    condition = condition_map.get(severity, "Laptop parameters operational")
    root_cause = likely_causes[0] if likely_causes else "No specific hardware malfunction identified"
    
    if severity == "Critical":
        impact = "High risk of data loss and sudden system failure"
        recommendation = "Seek professional diagnostic service immediately"
    elif severity == "High":
        impact = "Noticeable slowdown and thermal throttling under normal workload"
        recommendation = "Perform immediate hardware maintenance or component replacement"
    elif severity == "Moderate":
        impact = "Increased power draw and moderate performance overhead"
        recommendation = "Optimize background processes and verify airflow"
    else:
        impact = "System running normally with minor efficiency overhead"
        recommendation = "Routine maintenance and software updates"

    summary_text = (
        f"Condition: {condition}\n"
        f"Root cause: {root_cause}\n"
        f"Impact: {impact}\n"
        f"Recommendation: {recommendation}"
    )
    
    return {
        "issue_category": category,
        "severity": severity,
        "likely_causes": likely_causes,
        "diagnosis_summary": summary_text,
        "recommended_actions": recommended_actions,
        "hardware_risk": "High physical risk if unresolved" if severity in ["High", "Critical"] else "Low immediate hardware risk.",
        "repair_recommendation": "Professional repair/replacement recommended." if severity in ["High", "Critical"] else "No professional intervention required.",
        "_is_fallback": True
    }

@app.route("/api/llm/analyze", methods=["POST"])
def analyze_with_llm():
    import requests
    try:
        data = request.json or {}
        hardware = data.get("hardware") or {}
        user_responses = data.get("userResponses") or {}
        
        # Extract symptoms from new frontend structure or fall back to old keys
        issue = user_responses.get("issue", "").lower()
        issue_other = user_responses.get("issueOther", "").lower()
        
        battery_drain = "yes" if (
            user_responses.get("batteryDrain") == "yes" or 
            "battery" in issue or 
            "drain" in issue_other or 
            "battery" in issue_other
        ) else "no"
        
        slower_performance = "yes" if (
            user_responses.get("slowerPerformance") == "yes" or 
            issue == "slow" or 
            "slow" in issue_other or 
            "lag" in issue_other or 
            "freeze" in issue_other
        ) else "no"
        
        noises_or_heating = "yes" if (
            user_responses.get("noisesOrHeating") == "yes" or 
            issue in ["overheating", "noise"] or 
            "heat" in issue_other or 
            "hot" in issue_other or 
            "noise" in issue_other or 
            "fan" in issue_other
        ) else "no"
        
        unexpected_shutdown = "yes" if (
            user_responses.get("unexpectedShutdown") == "yes" or 
            issue == "shutdown" or 
            "shutdown" in issue_other or 
            "restart" in issue_other or 
            "turn off" in issue_other
        ) else "no"
        
        # Format payload to match Structured Diagnostic Prompt inputs
        llm_input = {
            "battery": {
                "drain": battery_drain,
                "charging": "yes" if (hardware.get("battery") or {}).get("is_charging") or (hardware.get("battery") or {}).get("isCharging") else "no",
                "health_percent": (hardware.get("battery") or {}).get("health", 100)
            },
            "performance": {
                "slowdown": slower_performance,
                "temperature": f"{(hardware.get('cpu') or {}).get('temperature', 50)} C",
                "fan_noise": noises_or_heating
            },
            "system": {
                "shutdowns": unexpected_shutdown,
                "lag_type": "lag" if slower_performance == "yes" else "none"
            }
        }
        
        system_prompt = """You are an expert AI Laptop Diagnostic Engineer.
Your job is to analyze structured laptop health and symptom data and generate accurate, practical maintenance advice.
You will receive input in JSON format containing hardware metrics, battery behavior, performance signals, and user-reported symptoms.
Core Objective:
1. Identify the most likely root causes of the issues.
2. Classify the problem type (Battery, Thermal, Performance, Hardware, Software, or Mixed).
3. Estimate severity level (Low, Moderate, High, Critical).
4. Provide clear, actionable steps to fix or improve the issue.
5. Suggest whether professional repair or replacement is needed.
Reasoning Rules:
- Prioritize hardware signals over subjective user answers.
- Correlate multiple symptoms together before concluding.
- If battery health is low AND fast drain exists, treat as battery degradation.
- If overheating AND lag exist together, prioritize thermal throttling.
- If shutdowns exist, always consider hardware risk as high priority.
- If data is incomplete, state uncertainty clearly but still give best estimate.
Summary Output & Style Rules (VERY IMPORTANT):
- diagnosis_summary must be written in a clear, professional, user-friendly way.
- Do NOT use contradictory statements (e.g. 'critical' + 'healthy system').
- Do NOT mix raw metrics with conclusions without explanation.
- Avoid technical overload and keep tone professional but easy to understand.
- Focus on 'what is happening' + 'why it matters'.
- The diagnosis_summary MUST follow this labeled 4-line structure exactly:
  Condition: <Current system condition (simple)>
  Root cause: <Main issue explanation (root cause)>
  Impact: <Impact on user experience>
  Recommendation: <Short recommendation direction>
Severity Consistency Rules (CRITICAL):
- You must ensure consistency between severity, health index (battery health & overall system), and recommendations.
- If overall system health > 80% -> severity CANNOT be 'Critical'.
- If overall system health is between 60% and 80% -> severity MUST be 'Moderate'.
- If overall system health is < 60% -> severity MUST be 'High' or 'Critical' (use 'Critical' only if multiple major failures exist).
- Never exaggerate severity for minor issues. Prefer accurate classification over dramatic wording.
Output Format (STRICT JSON):
Return only JSON in this format:
{
  "issue_category": "",
  "severity": "",
  "likely_causes": [],
  "diagnosis_summary": "",
  "recommended_actions": [],
  "hardware_risk": "",
  "repair_recommendation": ""
}
Output Rules:
- Be concise but technically accurate.
- Do not include unnecessary explanation outside JSON.
- Use clear technical language suitable for engineers and end users.
- Prioritize actionable solutions over theory.
- If critical risk is detected, explicitly mention it in hardware_risk."""

        keys = _get_all_keys()
        openrouter_key = keys.get("openrouter_key")
        parsed_response = None
        
        if openrouter_key and len(openrouter_key) > 10:
            try:
                headers = {
                    "Authorization": f"Bearer {openrouter_key}",
                    "Content-Type": "application/json"
                }
                payload = {
                    "model": "openai/gpt-4o-mini",
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": json.dumps(llm_input)}
                    ],
                    "temperature": 0.3
                }
                res = requests.post("https://openrouter.ai/api/v1/chat/completions", json=payload, headers=headers, timeout=20)
                
                if res.status_code == 200:
                    raw_content = res.json()["choices"][0]["message"]["content"].strip()
                    parsed_response = _safe_extract_json(raw_content)
                else:
                    logger.warning(f"OpenRouter direct analysis API error ({res.status_code}): {res.text}")
            except Exception as e:
                logger.warning(f"LLM diagnostics failed. Activating deterministic fallback engine: {e}")
        
        # Fallback to local rule engine if API is offline
        if not parsed_response:
            logger.info("Executing local fallback rule engine for diagnostics.")
            parsed_response = run_fallback_rules(hardware, user_responses)
            
        # Post-process response to map to visual components
        severity = parsed_response.get("severity", "Low")
        overall_health = hardware.get("overallHealth", 100)
        overall_rul = hardware.get("overallRUL", 24)
        
        # Calculate user priority indices
        priority_map = {"critical": "Urgent", "high": "Urgent", "moderate": "Moderate", "low": "Low"}
        priority = priority_map.get(str(severity).lower(), "Low")
        
        # Calculate visual life expectancy (in years) based on severity
        if "critical" in str(severity).lower():
            lifespan, efficiency = 0.5, min(35, overall_health)
        elif "high" in str(severity).lower():
            lifespan, efficiency = 1.2, min(55, overall_health)
        elif "moderate" in str(severity).lower():
            lifespan, efficiency = 2.2, min(75, overall_health)
        else:
            lifespan, efficiency = round(max(3.0, overall_rul / 12), 1), overall_health
            
        summary_text = parsed_response.get("diagnosis_summary", "")
        if parsed_response.get("hardware_risk"):
            summary_text += f"\n\n**Hardware Risk:** {parsed_response['hardware_risk']}"
        if parsed_response.get("repair_recommendation"):
            summary_text += f"\n\n**Repair/Replacement recommendation:** {parsed_response['repair_recommendation']}"
            
        # Ensure possible_causes, issues_detected, and advice are returned as strings matching the frontend expected keys
        possible_causes = "\n".join(f"• {c}" for c in parsed_response.get("likely_causes", [])) if isinstance(parsed_response.get("likely_causes"), list) else parsed_response.get("likely_causes", "")
        
        issues_detected = parsed_response.get("hardware_risk", "")
        if parsed_response.get("repair_recommendation"):
            if issues_detected:
                issues_detected += f"\n\n{parsed_response['repair_recommendation']}"
            else:
                issues_detected = parsed_response['repair_recommendation']
        
        actions_list = parsed_response.get("recommended_actions", [])
        advice = "\n".join(f"• {a}" for a in actions_list) if isinstance(actions_list, list) else actions_list

        return jsonify({
            "summary": summary_text,
            "issues": parsed_response.get("likely_causes", []),
            "actions": parsed_response.get("recommended_actions", []),
            "estimatedLifespan": lifespan,
            "efficiency": efficiency,
            "priority": priority,
            "analysedAt": datetime.datetime.now().isoformat(),
            "model": "GPT-4o-mini (Advisor)" if openrouter_key and parsed_response and not parsed_response.get("_is_fallback") else "Deterministic Local Rule Engine",
            "possible_causes": possible_causes,
            "issues_detected": issues_detected,
            "advice": advice,
            "combined_insight": parsed_response.get("repair_recommendation", "")
        })
    except Exception as e:
        logger.error(f"Diagnostic API Critical Error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/reports/save", methods=["POST"])
def save_report():
    with state_lock:
        report = request.json
        report["id"] = datetime.datetime.now().strftime("%Y%m%d%H%M%S")
        scan_history.insert(0, report)
        if len(scan_history) > 50: scan_history.pop()
        return jsonify(report)

@app.route("/api/reports/history", methods=["GET"])
def get_history():
    return jsonify(scan_history)

@app.route("/api/chatbot", methods=["POST"])
@app.route("/api/ai/chat", methods=["POST"])
def chatbot_proxy():
    try:
        data = request.json or {}
        messages = data.get("messages", [])
        keys = _get_all_keys()
        response = chatbot_chat(messages, **keys)
        return jsonify({
            "success": True,
            "reply": response,
            "response": response
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/transcribe", methods=["POST"])
def transcribe_proxy():
    if 'file' not in request.files: return jsonify({"error": "No audio"}), 400
    f = request.files['file']
    path = "temp_audio.webm"
    try:
        f.save(path)
        text = transcribe_audio(path)
        return jsonify({"text": text})
    except Exception as e:
        logger.error(f"Transcription error: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        if os.path.exists(path): os.remove(path)

# --- Helper Functions ---

def _get_all_keys():
    """Aggregates keys from various sources, prioritizing absolute script paths."""
    keys = {
        "groq_key": os.environ.get("GROQ_API_KEY"),
        "openai_key": os.environ.get("OPENAI_API_KEY"),
        "gemini_key": os.environ.get("GEMINI_API_KEY"),
        "anthropic_key": os.environ.get("ANTHROPIC_API_KEY"),
        "openrouter_key": os.environ.get("OPENROUTER_API_KEY")
    }
    
    try:
        # Determine base directory
        if getattr(sys, 'frozen', False):
            base_dir = os.path.dirname(sys.executable)
        else:
            base_dir = os.path.dirname(os.path.abspath(__file__))

        local_env = os.path.join(base_dir, ".env")
        parent_env = os.path.join(os.path.dirname(base_dir), "auth-backend", ".env")
        env_path = local_env if os.path.exists(local_env) else parent_env
        
        if os.path.exists(env_path):
            with open(env_path, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith('#'): continue
                    if '=' in line:
                        parts = line.split('=', 1)
                        if len(parts) != 2: continue
                        k = parts[0].strip()
                        v = parts[1].strip().strip('"').strip("'") # Remove potential quotes
                        if k == 'OPENAI_API_KEY' and not keys["openai_key"]: keys["openai_key"] = v
                        if k == 'GROQ_API_KEY' and not keys["groq_key"]: keys["groq_key"] = v
                        if k == 'GEMINI_API_KEY' and not keys["gemini_key"]: keys["gemini_key"] = v
                        if k == 'ANTHROPIC_API_KEY' and not keys["anthropic_key"]: keys["anthropic_key"] = v
                        if k == 'OPENROUTER_API_KEY' and not keys["openrouter_key"]: keys["openrouter_key"] = v
    except Exception as e:
        logger.error(f"Error reading .env file: {e}")
        
    return keys

def _safe_extract_json(text):
    try:
        match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', text, re.DOTALL)
        if match: return json.loads(match.group(1))
        match = re.search(r'(\{.*\})', text, re.DOTALL)
        if match: return json.loads(match.group(1))
        return None
    except: return None

# --- Shutdown Handler ---
def signal_handler(sig, frame):
    global is_shutting_down
    logger.info("Shutdown signal received. Cleaning up...")
    is_shutting_down = True
    sys.exit(0)

signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)

if __name__ == "__main__":
    logger.info("="*40)
    logger.info("  LAPGUARD AI BACKEND v4.0  ")
    logger.info("  Port: 5050 | Mode: Debug  ")
    logger.info("="*40)
    app.run(host="0.0.0.0", port=5050, debug=False) # Debug False to prevent double thread start
