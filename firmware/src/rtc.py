from machine import I2C, Pin
from logger import Logger

MODULE = "RTC"


class RTCNotFoundError(Exception):
    """Raised when DS3231 is not detected on the I2C bus."""
    pass


class TimeRead:
    """DS3231 RTC module controller."""

    _DS3231_I2C_ADDR = 0x68

    def __init__(self, scl_pin=22, sda_pin=21, bus_id=0):
        self.i2c = I2C(
            bus_id,
            scl=Pin(scl_pin),
            sda=Pin(sda_pin)
        )

        Logger.debug(
            MODULE,
            "I2C_INIT",
            {
                "busId": bus_id,
                "sclPin": scl_pin,
                "sdaPin": sda_pin
            }
        )

        devices = self.i2c.scan()

        Logger.debug(
            MODULE,
            "I2C_SCAN",
            {
                "devices": devices
            }
        )

        if self._DS3231_I2C_ADDR not in self.i2c.scan():
            Logger.error(
                MODULE,
                "RTC_NOT_FOUND",
                {
                    "expectedAddress": hex(self._DS3231_I2C_ADDR),
                    "detectedDevices": devices
                }
            )

            raise RTCNotFoundError("DS3231 not found on I2C bus")
        
        Logger.info(
            MODULE,
            "RTC_DETECTED",
            {
                "address": hex(self._DS3231_I2C_ADDR)
            }
        )

    def _decode_bcd(self, value):
        """Decode BCD value to integer."""
        return (value // 16) * 10 + (value % 16)

    def _encode_bcd(self, value):
        """Encode integer to BCD format."""
        return (value // 10) * 16 + (value % 10)

    def get_datetime(self):
        """Return current RTC datetime as tuple."""
        data = self.i2c.readfrom_mem(self._DS3231_I2C_ADDR, 0x00, 7)

        second = self._decode_bcd(data[0] & 0x7F)
        minute = self._decode_bcd(data[1])
        hour = self._decode_bcd(data[2] & 0x3F)
        day = self._decode_bcd(data[3])
        date = self._decode_bcd(data[4])
        month = self._decode_bcd(data[5] & 0x1F)

        century = (data[5] & 0x80) >> 7
        year = self._decode_bcd(data[6])
        year += 2000 + (100 if century else 0)

        Logger.trace(
            MODULE,
            "RTC_RAW_DATA",
            {
                "data": list(data)
            }
        )

        return year, month, date, day, hour, minute, second

    def set_datetime(self, year, month, date, day, hour, minute, second):
        """Set RTC datetime."""
        if year < 2000 or year >= 2200:
            Logger.error(
                MODULE,
                "INVALID_YEAR_VALUE",
                {
                    "year": year,
                    "min": 2000,
                    "max": 2199
                }
            )
            raise ValueError("Year must be between 2000 and 2199")

        century = 0x80 if year >= 2100 else 0x00
        year_offset = year - (2100 if century else 2000)

        data = bytearray(7)
        data[0] = self._encode_bcd(second)
        data[1] = self._encode_bcd(minute)
        data[2] = self._encode_bcd(hour)
        data[3] = self._encode_bcd(day)
        data[4] = self._encode_bcd(date)
        data[5] = self._encode_bcd(month) | century
        data[6] = self._encode_bcd(year_offset)

        Logger.info(
            MODULE,
            "RTC_SET_DATETIME",
            {
                "year": year,
                "month": month,
                "date": date,
                "day": day,
                "hour": hour,
                "minute": minute,
                "second": second
            }
        )

        self.i2c.writeto_mem(self._DS3231_I2C_ADDR, 0x00, data)
        
        Logger.debug(
            MODULE,
            "RTC_WRITE_COMPLETE"
        )
