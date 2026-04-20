from machine import ADC, Pin
import time


class Battery:
    """LiPo monitor: voltage and percent"""

    ADC_PIN = 35
    DIVIDER_RATIO = 1.435

    # LiPo LUT (voltage -> percentage)
    LUT = [
        (4.20, 100),
        (4.10, 90),
        (4.00, 80),
        (3.90, 70),
        (3.80, 60),
        (3.70, 50),
        (3.60, 40),
        (3.50, 25),
        (3.40, 15),
        (3.30, 5),
        (3.20, 0),
    ]

    def __init__(self, samples=16, calibration=1.0):
        """Init ADC and state."""
        self.adc = ADC(Pin(self.ADC_PIN))
        self.adc.atten(ADC.ATTN_11DB)

        self.samples = samples
        self.calibration = calibration

    # ---------- Low level ----------

    def _read_voltage(self):
        """Return battery voltage (V)."""
        total = 0
        for _ in range(self.samples):
            total += self.adc.read_uv()

        v_adc = (total / self.samples) / 1_000_000
        return v_adc * self.DIVIDER_RATIO * self.calibration

    def _voltage_to_percent(self, v):
        """Linear interpolation from LUT."""
        lut = self.LUT

        if v >= lut[0][0]:
            return 100
        if v <= lut[-1][0]:
            return 0

        for i in range(len(lut) - 1):
            v1, p1 = lut[i]
            v2, p2 = lut[i + 1]

            if v2 <= v <= v1:
                ratio = (v - v2) / (v1 - v2)
                return int(p2 + ratio * (p1 - p2))

        return 0

    # ---------- Public ----------

    def read(self):
        """Return voltage and percent."""
        voltage = self._read_voltage()
        percent = self._voltage_to_percent(voltage)

        return {
            "voltage": round(voltage, 3),
            "percent": percent,
        }