from machine import ADC, Pin
import time


class Battery:
    """Battery monitoring with filtering, calibration and time tracking."""

    # Hardware constants
    ADC_PIN = 35
    ADC_MAX = 4095
    VREF = 3.3
    DIVIDER_RATIO = 1.435

    # LiPo LUT (voltage -> percentage)
    LUT = [
        (4.20, 100),
        (4.00, 85),
        (3.90, 70),
        (3.80, 60),
        (3.70, 50),
        (3.60, 40),
        (3.50, 25),
        (3.40, 15),
        (3.30, 5),
        (3.20, 0),
    ]

    def __init__(self, samples=20, calibration=1.0):
        """Initialize battery monitor."""
        self.adc = ADC(Pin(self.ADC_PIN))
        self.adc.atten(ADC.ATTN_11DB)

        self.samples = samples
        self.calibration = calibration

        self.history = []
        self.last_measure = None

    # Low level
    def _read_raw(self):
        """Read averaged raw ADC value."""
        total = 0
        for _ in range(self.samples):
            total += self.adc.read()
        return total / self.samples

    def _raw_to_voltage(self, raw):
        """Convert raw ADC value to battery voltage."""
        v_adc = (raw / self.ADC_MAX) * self.VREF
        v_batt = v_adc * self.DIVIDER_RATIO
        return v_batt * self.calibration

    def _voltage_to_percent(self, voltage):
        """Convert voltage to percentage using LUT interpolation."""
        lut = self.LUT

        if voltage >= lut[0][0]:
            return 100
        if voltage <= lut[-1][0]:
            return 0

        for i in range(len(lut) - 1):
            v1, p1 = lut[i]
            v2, p2 = lut[i + 1]

            if v2 <= voltage <= v1:
                # linear interpolation
                ratio = (voltage - v2) / (v1 - v2)
                return p2 + ratio * (p1 - p2)

        return 0

    # Public API
    def read(self):
        """Perform full battery measurement."""
        raw = self._read_raw()
        voltage = self._raw_to_voltage(raw)
        percent = self._voltage_to_percent(voltage)

        timestamp = time.time()

        measure = {
            "time": timestamp,
            "raw": raw,
            "voltage": voltage,
            "percent": percent,
        }

        self._update_history(measure)

        return measure

    def _update_history(self, measure):
        """Store measurement and compute consumption."""
        if self.last_measure:
            dt = measure["time"] - self.last_measure["time"]
            dv = measure["voltage"] - self.last_measure["voltage"]

            measure["dt"] = dt
            measure["dv"] = dv

            if dt > 0:
                measure["consumption_v_per_h"] = (dv / dt) * 3600
            else:
                measure["consumption_v_per_h"] = 0
            
        else:
            measure["dt"] = 0
            measure["dv"] = 0
            measure["consumption_v_per_h"] = 0
        self._compute_state(measure)

        self.history.append(measure)
        self.last_measure = measure

        if len(self.history) > 500:
            self.history.pop(0)

    # Analysis
    def get_average_consumption(self):
        """Return average voltage consumption per hour."""
        if len(self.history) < 2:
            return 0

        total = 0
        count = 0

        for m in self.history:
            if m["consumption_v_per_h"] != 0:
                total += m["consumption_v_per_h"]
                count += 1

        return total / count if count else 0
    
    def _compute_state(self, measure):
        """Determine charging state and rate."""
        dv = measure["dv"]
        dt = measure["dt"]

        if dt == 0:
            measure["state"] = "unknown"
            measure["rate_v_per_h"] = 0
            return

        rate = (dv / dt) * 3600
        measure["rate_v_per_h"] = rate

        # thresholds to avoid noise
        if rate > 0.01:
            measure["state"] = "charging"
        elif rate < -0.01:
            measure["state"] = "discharging"
        else:
            measure["state"] = "idle"

    def estimate_remaining_hours(self):
        """Estimate remaining battery life in hours."""
        if not self.last_measure:
            return None

        consumption = self.get_average_consumption()

        if consumption >= 0:
            return None  # charging or unstable

        voltage = self.last_measure["voltage"]
        remaining_v = voltage - 3.2  # cutoff

        return remaining_v / abs(consumption) if consumption else None

    def get_last(self):
        """Return last measurement."""
        return self.last_measure