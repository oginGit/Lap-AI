"""
health_predictor.py — Health score calculation and 6-month degradation predictions
Uses degradation curves based on real hardware research:
  - CPU: temperature-based thermal degradation model
  - Battery: cycle-count and capacity-based electrochemical model
  - Hard Drive: SMART-attribute-based Weibull reliability model
"""

import math


class HealthPredictor:
    """Calculates health scores and predicts RUL for CPU, battery, and hard drive."""

    # ─── CPU Health ──────────────────────────────────────────────────────────
   

def calculate_cpu_health(cpu_data):
    # Constants
    L0 = 36
    T_ref = 60
    k = 0.07
    beta = 0.3

    # Inputs
    temp = cpu_data.get("temperature", 60)
    usage = cpu_data.get("usage", 50) / 100

    # Temperature impact
    temp_factor = math.exp(-k * (temp - T_ref))

    # Usage impact
    usage_factor = (1 - beta * usage)

    # Base RUL
    rul = L0 * temp_factor * usage_factor

    # 🔹 ADD TREND FACTOR HERE
    trend_factor = cpu_data.get("temp_trend", 0)
    rul = rul * (1 - 0.1 * trend_factor)

    # Final clamp
    rul = max(1, min(36, int(rul)))

    return rul

    # ─── Battery Health ──────────────────────────────────────────────────────

    def calculate_battery_health(self, battery_data):
        """
        Battery health based on capacity degradation, cycle count, and voltage.
        Uses an electrochemical aging model:
        - Capacity fade: linear + calendar aging
        - Cycle degradation: ~20% capacity loss per 500 full cycles (Li-ion)
        """
        percent = battery_data.get("percent", 50)
        design_cap = battery_data.get("design_capacity", 50000)
        full_cap = battery_data.get("full_charge_capacity", 42000)
        cycles = battery_data.get("cycle_count", 0)
        voltage = battery_data.get("voltage", 11.4)
        temp = battery_data.get("temperature", 35)
        discharge_rate = battery_data.get("discharge_rate", 0)

        # Capacity-based health (most accurate metric)
        if design_cap > 0 and full_cap > 0:
            capacity_ratio = min(1.0, full_cap / design_cap)
            capacity_score = round(capacity_ratio * 100)
        else:
            capacity_score = 85  # Assume decent health if unknown

        # Cycle-based degradation
        # Li-ion batteries: ~80% capacity at 300-500 cycles
        cycle_penalty = 0
        if cycles > 800:
            cycle_penalty = 30
        elif cycles > 500:
            cycle_penalty = 20
        elif cycles > 300:
            cycle_penalty = 10
        elif cycles > 100:
            cycle_penalty = 5

        # Voltage factor
        voltage_penalty = 0
        if voltage < 10.0:
            voltage_penalty = 15  # Low voltage indicates cell degradation
        elif voltage < 10.5:
            voltage_penalty = 8

        # Temperature factor
        temp_penalty = 0
        if temp > 45:
            temp_penalty = 10
        elif temp > 40:
            temp_penalty = 5

        # Discharge rate factor
        discharge_penalty = 0
        if discharge_rate > 30:
            discharge_penalty = 8  # Very fast drain
        elif discharge_rate > 20:
            discharge_penalty = 4

        # Combined score
        score = max(5, min(100, capacity_score - cycle_penalty - voltage_penalty - temp_penalty - discharge_penalty))

        # RUL prediction (months)
        # Based on capacity degradation curve and cycle count
        if score >= 90:
            rul_months = 24
        elif score >= 80:
            rul_months = 18
        elif score >= 70:
            rul_months = 12
        elif score >= 60:
            rul_months = 8
        elif score >= 50:
            rul_months = 4
        else:
            rul_months = max(1, int((score / 50) * 4))

        # Adjust for high cycle count
        if cycles > 500:
            rul_months = max(1, rul_months - 3)
        elif cycles > 300:
            rul_months = max(1, rul_months - 1)

        return {
            "score": score,
            "rul_months": rul_months,
            "rul_percent": min(100, round((rul_months / 24) * 100)),
            "status": self._get_status(score),
            "capacity_ratio": round((full_cap / max(design_cap, 1)) * 100, 1),
            "risk_factors": self._battery_risk_factors(cycles, voltage, temp, discharge_rate, capacity_score),
        }

    def _battery_risk_factors(self, cycles, voltage, temp, discharge_rate, cap_score):
        factors = []
        if cap_score < 70:
            factors.append(f"Battery capacity severely degraded ({cap_score}% of design)")
        elif cap_score < 85:
            factors.append(f"Battery capacity below optimal ({cap_score}% of design)")
        if cycles > 500:
            factors.append(f"High cycle count ({cycles}) — nearing end of optimal life")
        if voltage < 10.5:
            factors.append("Below-normal voltage detected — possible cell degradation")
        if temp > 40:
            factors.append("Elevated battery temperature — avoid charging while gaming")
        if discharge_rate > 25:
            factors.append("High discharge rate — power-hungry processes may be running")
        return factors

    # ─── Hard Drive Health ───────────────────────────────────────────────────

    def calculate_drive_health(self, drive_data):
        """
        Hard drive health based on SMART attributes.
        Uses a Weibull reliability model considering:
        - Reallocated sectors (most critical SMART indicator)
        - Pending sectors
        - Power-on hours
        - Temperature
        - Spin retry count
        """
        realloc = drive_data.get("reallocated_sectors", 0)
        pending = drive_data.get("pending_sectors", 0)
        poh = drive_data.get("power_on_hours", 0)
        temp = drive_data.get("temperature", 35)
        spin_retry = drive_data.get("spin_retry_count", 0)
        realloc_events = drive_data.get("reallocated_event_count", 0)
        smart_health = drive_data.get("smart_health", 95)

        # Reallocated sectors (most critical — exponential penalty)
        if realloc == 0:
            realloc_score = 100
        elif realloc <= 2:
            realloc_score = 90
        elif realloc <= 5:
            realloc_score = 75
        elif realloc <= 10:
            realloc_score = 55
        elif realloc <= 20:
            realloc_score = 35
        else:
            realloc_score = max(5, 35 - (realloc - 20))

        # Pending sectors
        pending_penalty = min(30, pending * 8)

        # Power-on hours (wear factor)
        if poh < 10000:
            poh_score = 100
        elif poh < 20000:
            poh_score = 90
        elif poh < 30000:
            poh_score = 75
        elif poh < 40000:
            poh_score = 60
        elif poh < 50000:
            poh_score = 45
        else:
            poh_score = max(10, 45 - int((poh - 50000) / 5000))

        # Temperature penalty
        temp_penalty = 0
        if temp > 55:
            temp_penalty = 20
        elif temp > 50:
            temp_penalty = 10
        elif temp > 45:
            temp_penalty = 5

        # Spin retry penalty
        spin_penalty = min(15, spin_retry * 5)

        # Combined health score
        base_score = (realloc_score * 0.40 + poh_score * 0.30 + smart_health * 0.30)
        score = max(5, min(100, round(base_score - pending_penalty - temp_penalty - spin_penalty)))

        # RUL prediction (months)
        # Weibull-inspired: drive failure probability increases exponentially near end of life
        if score >= 90:
            rul_months = 48
        elif score >= 80:
            rul_months = 36
        elif score >= 70:
            rul_months = 24
        elif score >= 60:
            rul_months = 16
        elif score >= 50:
            rul_months = 10
        elif score >= 40:
            rul_months = 6
        else:
            rul_months = max(1, int((score / 40) * 6))

        # Adjust for high sector counts
        if realloc > 10:
            rul_months = max(1, rul_months - 6)
        if pending > 0:
            rul_months = max(1, rul_months - 3)

        return {
            "score": score,
            "rul_months": rul_months,
            "rul_percent": min(100, round((rul_months / 48) * 100)),
            "status": self._get_status(score),
            "risk_factors": self._drive_risk_factors(realloc, pending, poh, temp, spin_retry),
        }

    def _drive_risk_factors(self, realloc, pending, poh, temp, spin_retry):
        factors = []
        if realloc > 5:
            factors.append(f"{realloc} reallocated sectors — drive surface degradation detected")
        elif realloc > 0:
            factors.append(f"{realloc} reallocated sectors — minor, but monitor closely")
        if pending > 0:
            factors.append(f"{pending} pending sectors — data integrity at risk, backup immediately")
        if poh > 40000:
            factors.append(f"{poh} power-on hours — drive is approaching typical end-of-life")
        elif poh > 25000:
            factors.append(f"{poh} power-on hours — moderate wear")
        if temp > 50:
            factors.append("Drive temperature above safe threshold — check ventilation")
        if spin_retry > 0:
            factors.append(f"{spin_retry} spin retries — possible mechanical issue")
        return factors

    # ─── 6-Month Predictions ─────────────────────────────────────────────────

    def predict_6_months(self, cpu_health, battery_health, drive_health):
        """
        Generate month-by-month health predictions for the next 6 months.
        Uses component-specific degradation curves.
        """
        predictions = []

        cpu_score = cpu_health["score"]
        bat_score = battery_health["score"]
        drv_score = drive_health["score"]

        for month in range(7):  # 0 = now, 1-6 = future months
            if month == 0:
                predictions.append({
                    "month": "Now",
                    "cpu": cpu_score,
                    "battery": bat_score,
                    "drive": drv_score,
                    "overall": round((cpu_score * 0.30 + bat_score * 0.35 + drv_score * 0.35)),
                })
            else:
                # CPU degradation: slower (thermal damage is gradual unless extreme)
                cpu_deg = self._cpu_monthly_degradation(cpu_score, month)
                
                # Battery degradation: fastest (electrochemical aging is continuous)
                bat_deg = self._battery_monthly_degradation(bat_score, month)
                
                # Drive degradation: moderate (mechanical/electronic wear)
                drv_deg = self._drive_monthly_degradation(drv_score, month)

                cpu_pred = max(5, round(cpu_score - cpu_deg))
                bat_pred = max(5, round(bat_score - bat_deg))
                drv_pred = max(5, round(drv_score - drv_deg))

                predictions.append({
                    "month": f"+{month}mo",
                    "cpu": cpu_pred,
                    "battery": bat_pred,
                    "drive": drv_pred,
                    "overall": round((cpu_pred * 0.30 + bat_pred * 0.35 + drv_pred * 0.35)),
                })

        return predictions

    def _cpu_monthly_degradation(self, current_score, months):
        """CPU degradation is slow at good health, faster at poor health."""
        if current_score >= 80:
            rate = 1.5  # 1.5 pts/month when healthy
        elif current_score >= 60:
            rate = 2.5
        else:
            rate = 4.0  # Accelerated degradation at poor health
        return rate * months

    def _battery_monthly_degradation(self, current_score, months):
        """
        Battery degradation follows a capacity fade curve:
        - Faster degradation at low health (positive feedback loop)
        - ~1-2% capacity loss per month under normal use
        """
        if current_score >= 85:
            rate = 2.0  # ~2%/month
        elif current_score >= 70:
            rate = 3.0
        elif current_score >= 50:
            rate = 4.5
        else:
            rate = 6.0  # Rapid decline
        return rate * months

    def _drive_monthly_degradation(self, current_score, months):
        """Drive degradation: gradual for SSDs, faster for HDDs with issues."""
        if current_score >= 85:
            rate = 0.8  # SSDs age very slowly
        elif current_score >= 70:
            rate = 1.5
        elif current_score >= 50:
            rate = 3.0
        else:
            rate = 5.0  # Rapid decline with SMART issues
        return rate * months

    # ─── Helpers ─────────────────────────────────────────────────────────────

    @staticmethod
    def _get_status(score):
        if score >= 80:
            return "Good"
        elif score >= 60:
            return "Warning"
        else:
            return "Critical"
