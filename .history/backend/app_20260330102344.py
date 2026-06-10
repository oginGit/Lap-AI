n"""
app.py — Flask Backend for LaptopMD Health Monitor
Reads real CPU, battery, and hard drive metrics from the system.
Provides REST API endpoints consumed by the React frontend.
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
from hardware_monitor import HardwareMonitor
from health_predictor import HealthPredictor
import datetime

app = Flask(__name__)
CORS(app, origins="*")

monitor = HardwareMonitor()
predictor = HealthPredictor()

# In-memory history storage (replace with DB in production)
scan_history = []


@app.route("/api/health", methods=["GET"])
def health_check():
    """Simple health check endpoint."""
    return jsonify({"status": "ok", "server": "LaptopMD Backend", "time": datetime.datetime.now().isoformat()})


@app.route("/api/hardware/status", methods=["GET"])
def get_hardware_status():
    """
    Main endpoint — reads real hardware metrics and calculates health scores.
    Returns CPU, battery, hard drive data with RUL predictions.
    """
    try:
        # Gather real hardware data
        cpu_data = monitor.get_cpu_info()
        battery_data = monitor.get_battery_info()
        drive_data = monitor.get_drive_info()

        # Calculate health scores and RUL predictions
        cpu_health = predictor.calculate_cpu_health(cpu_data)
        battery_health = predictor.calculate_battery_health(battery_data)
        drive_health = predictor.calculate_drive_health(drive_data)

        # Overall system health (weighted average)
        overall_health = round(
            cpu_health["score"] * 0.30
            + battery_health["score"] * 0.35
            + drive_health["score"] * 0.35
        )

        # Build 6-month prediction timeline
        predictions = predictor.predict_6_months(cpu_health, battery_health, drive_health)

        response = {
            "timestamp": datetime.datetime.now().isoformat(),
            "cpu": {
                "temperature": cpu_data["temperature"],
                "usage": cpu_data["usage"],
                "cores": cpu_data["cores"],
                "speed": cpu_data["speed"],
                "model": cpu_data["model"],
                "status": cpu_health["status"],
                "rul": cpu_health["rul_months"],
                "rulPercent": cpu_health["rul_percent"],
                "healthScore": cpu_health["score"],
                "usageTrend": cpu_data.get("usage_trend", []),
                "tempTrend": cpu_data.get("temp_trend", []),
                "maxTemp": cpu_data.get("max_temp", cpu_data["temperature"]),
                "avgTemp": cpu_data.get("avg_temp", cpu_data["temperature"]),
                "perCoreUsage": cpu_data.get("per_core_usage", []),
                "freqCurrent": cpu_data.get("freq_current", cpu_data["speed"]),
                "freqMax": cpu_data.get("freq_max", cpu_data["speed"]),
            },
            "battery": {
                "percent": battery_data["percent"],
                "health": battery_health["score"],
                "capacity": battery_data["design_capacity"],
                "currentCapacity": battery_data["full_charge_capacity"],
                "cycles": battery_data["cycle_count"],
                "voltage": battery_data["voltage"],
                "chargingSpeed": battery_data["charging_speed"],
                "dischargeRate": battery_data["discharge_rate"],
                "temperature": battery_data["temperature"],
                "status": battery_health["status"],
                "rul": battery_health["rul_months"],
                "rulPercent": battery_health["rul_percent"],
                "isCharging": battery_data["is_charging"],
                "timeRemaining": battery_data["time_remaining"],
                "healthScore": battery_health["score"],
            },
            "drive": {
                "health": drive_health["score"],
                "temperature": drive_data["temperature"],
                "used": drive_data["used_gb"],
                "total": drive_data["total_gb"],
                "reallocatedSectors": drive_data["reallocated_sectors"],
                "pendingSectors": drive_data["pending_sectors"],
                "powerOnHours": drive_data["power_on_hours"],
                "spinRetryCount": drive_data["spin_retry_count"],
                "reallocatedEventCount": drive_data["reallocated_event_count"],
                "status": drive_health["status"],
                "rul": drive_health["rul_months"],
                "rulPercent": drive_health["rul_percent"],
                "type": drive_data["type"],
                "model": drive_data["model"],
                "healthScore": drive_health["score"],
            },
            "overallHealth": overall_health,
            "overallRUL": round(
                (cpu_health["rul_months"] + battery_health["rul_months"] + drive_health["rul_months"]) / 3
            ),
            "predictions": predictions,
        }

        return jsonify(response)

    except Exception as e:
        print(f"Error reading hardware: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/api/llm/analyze", methods=["POST"])
def analyze_with_llm():
    """
    Analyze hardware data + user responses and generate maintenance advice.
    Uses rule-based analysis (replace with actual LLM API call in production).
    """
    try:
        data = request.json
        hardware = data.get("hardware", {})
        user_responses = data.get("userResponses", {})

        cpu = hardware.get("cpu", {})
        battery = hardware.get("battery", {})
        drive = hardware.get("drive", {})
        overall_health = hardware.get("overallHealth", 50)

        issues = []
        actions = []

        # CPU Analysis
        cpu_temp = cpu.get("temperature", 50)
        if cpu_temp > 85:
            issues.append(f"CPU is running at critically high temperatures ({cpu_temp:.0f}°C). Risk of thermal throttling and long-term damage.")
            actions.append("Apply fresh thermal paste and clean the cooling system immediately.")
            actions.append("Consider undervolting the CPU to reduce heat output.")
            actions.append("Use a laptop cooling pad for better airflow.")
        elif cpu_temp > 70:
            issues.append(f"CPU temperature is elevated ({cpu_temp:.0f}°C). This may indicate cooling system degradation.")
            actions.append("Clean laptop vents and ensure airflow is not obstructed.")
            actions.append("Check if thermal paste needs replacement.")

        # Battery Analysis
        bat_health = battery.get("health", battery.get("healthScore", 80))
        bat_cycles = battery.get("cycles", 0)
        if user_responses.get("batteryDrain") == "yes" or bat_health < 70:
            issues.append(f"Battery health is at {bat_health:.0f}% with {bat_cycles} charge cycles.")
            actions.append("Calibrate the battery: fully charge then fully discharge once monthly.")
            actions.append("Avoid leaving the laptop plugged in at 100% for extended periods.")
            if bat_health < 60:
                actions.append("Battery replacement is strongly recommended within 3-6 months.")

        # Drive Analysis
        realloc = drive.get("reallocatedSectors", 0)
        pending = drive.get("pendingSectors", 0)
        poh = drive.get("powerOnHours", 0)
        if realloc > 5 or pending > 0:
            issues.append(f"Hard drive shows {realloc} reallocated and {pending} pending sectors — early signs of failure.")
            actions.append("Back up all important data immediately to an external drive or cloud.")
            actions.append("Run a full disk diagnostic using CrystalDiskInfo or similar tool.")
        if poh > 35000:
            issues.append(f"Drive has {poh} power-on hours. Consider proactive replacement.")
            actions.append("Plan drive replacement within the next 6-12 months.")

        # Physical damage
        if user_responses.get("dropped") == "yes":
            issues.append("Physical drop detected. Internal components may have micro-fractures.")
            actions.append("Have a technician inspect the motherboard and HDD for physical damage.")

        # Noise / overheating
        if user_responses.get("noisesOrHeating") == "yes":
            issues.append("Unusual noises or excessive heating reported — possible fan or HDD failure.")
            actions.append("Run a hardware diagnostic tool to check fan RPM and HDD SMART data.")
            actions.append("Consider replacing the cooling fan if it makes grinding noises.")

        # Estimate lifespan
        if overall_health >= 80:
            lifespan = 3.5
        elif overall_health >= 60:
            lifespan = 2.0
        elif overall_health >= 40:
            lifespan = 1.0
        else:
            lifespan = 0.3

        overall_advice = (
            "Your laptop is in excellent health. Continue regular maintenance and monitor temperatures."
            if overall_health >= 80
            else "Your laptop is in moderate condition. Address the identified issues to extend its lifespan."
            if overall_health >= 60
            else "Your laptop requires urgent attention. Multiple components are showing signs of stress or failure."
        )

        if not actions:
            actions = [
                "Continue regular cleaning and software maintenance.",
                "Keep drivers and OS up to date for optimal performance.",
                "Monitor temperatures during intensive tasks.",
            ]

        return jsonify({
            "summary": overall_advice,
            "issues": issues if issues else ["No critical issues detected at this time."],
            "actions": actions,
            "estimatedLifespan": round(lifespan, 1),
            "efficiency": overall_health,
            "priority": "Urgent" if overall_health < 50 else "Moderate" if overall_health < 70 else "Low",
            "analysedAt": datetime.datetime.now().isoformat(),
            "model": "LaptopMD Rule-Based Analyzer v2.0",
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/reports/save", methods=["POST"])
def save_report():
    """Save a scan report to history."""
    try:
        report = request.json
        report["id"] = str(len(scan_history) + 1)
        report["date"] = datetime.datetime.now().isoformat()
        scan_history.insert(0, report)
        # Keep only last 50
        if len(scan_history) > 50:
            scan_history.pop()
        return jsonify(report)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/reports/history", methods=["GET"])
def get_history():
    """Get scan history."""
    return jsonify(scan_history)


if __name__ == "__main__":
    print("=" * 60)
    print("  LaptopMD Backend — Real Hardware Monitor")
    print("  API running at http://localhost:5050")
    print("=" * 60)
    app.run(host="0.0.0.0", port=5050, debug=True)
