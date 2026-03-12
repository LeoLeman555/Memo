import _thread
from logger import Logger

MODULE = "SCHEDULER"


class MemoScheduler:
    """Evaluate memos and trigger according to recurrence rules."""

    MEMO_FILE = "memo.json"

    def __init__(self, rtc, storage, audio):
        self.rtc = rtc
        self.storage = storage
        self.audio = audio

        self.memos = []
        self.last_checked_key = None  # (year, month, day, hour, minute)

        self._load_memos()

    def _load_memos(self):
        """Load memo.json."""
        data = self.storage.safe_read_json(self.MEMO_FILE, default=None)

        if not data or "items" not in data:
            Logger.warn(
                MODULE,
                "MEMO_FILE_INVALID",
                {"file": self.MEMO_FILE}
            )
            self.memos = []
            return

        self.memos = data["items"]
        Logger.info(
            MODULE,
            "MEMOS_LOADED",
            {"count": len(self.memos)}
        )

    def reload(self):
        """Reload memo file."""
        Logger.info(
            MODULE,
            "MEMOS_RELOAD_REQUEST"
        )
        self._load_memos()

    def tick(self):
        """Evaluate memos once per minute."""
        now = self.rtc.get_datetime()
        year, month, day, weekday, hour, minute, second = now
        Logger.trace(
            MODULE,
            "SCHED_TICK",
            {
                "year": year,
                "month": month,
                "day": day,
                "hour": hour,
                "minute": minute,
                "second": second
            }
        )

        current_key = (year, month, day, hour, minute)

        if current_key == self.last_checked_key:
            return

        self.last_checked_key = current_key

        for memo in self.memos:
            self._evaluate_memo(memo, now)

    def _evaluate_memo(self, memo, now):
        """Evaluate a single memo."""
        memo_id = memo.get("memoId")
        start_date = memo.get("startDate")
        memo_time = memo.get("time")
        audio_file = memo.get("audioFile")
        recurrence = memo.get("recurrence")

        Logger.debug(
            MODULE,
            "MEMO_EVALUATION",
            {
                "memoId": memo.get("memoId"),
                "memoTime": memo.get("time"),
                "now": now
            }
        )

        if not memo_id or not start_date or not memo_time or not audio_file:
            Logger.warn(
                MODULE,
                "MEMO_INVALID",
                {
                    "memo": memo
                }
            )
            return

        year, month, day, weekday, hour, minute, _ = now

        try:
            start_y, start_m, start_d = map(int, start_date.split("-"))
            memo_hour, memo_minute = map(int, memo_time.split(":"))
        except Exception:
            Logger.error(
                MODULE,
                "MEMO_PARSE_ERROR",
                {
                    "memoId": memo_id,
                    "startDate": start_date,
                    "time": memo_time
                }
            )
            return

        # Must be after start date
        if (year, month, day) < (start_y, start_m, start_d):
            Logger.debug(
                MODULE,
                "MEMO_SKIPPED_BEFORE_START",
                {
                    "memoId": memo_id,
                    "startDate": start_date
                }
            )
            return

        if hour != memo_hour or minute != memo_minute:
            return

        # One-shot
        if not recurrence or recurrence.get("frequency") is None:
            if (year, month, day) == (start_y, start_m, start_d):
                self._trigger(audio_file)
            return

        frequency = recurrence.get("frequency")
        interval = recurrence.get("interval", 1)
        count = recurrence.get("count")
        until = recurrence.get("until")

        # UNTIL check
        if until:
            try:
                uy, um, ud = map(int, until.split("-"))
                if (year, month, day) > (uy, um, ud):
                    Logger.debug(
                        MODULE,
                        "MEMO_UNTIL_EXPIRED",
                        {
                            "memoId": memo_id,
                            "until": until
                        }
                    )
                    return
            except Exception:
                pass

        # Count check
        if not self._within_count(memo, count):
            return

        delta_days = self._days_between(
            start_y, start_m, start_d,
            year, month, day
        )

        # DAILY
        if frequency == "DAILY":
            if delta_days % interval == 0:
                self._fire(memo, audio_file)
            return

        # WEEKLY
        if frequency == "WEEKLY":
            # Convert DS3231 weekday → app weekday (1=Mon..7=Sun)
            app_weekday = ((weekday + 5) % 7) + 1
            by_weekday = recurrence.get("byWeekday", [])

            weeks = self._weeks_between(start_y, start_m, start_d, year, month, day)

            if weeks < 0:
                return

            if weeks % interval != 0:
                return

            if by_weekday and app_weekday not in by_weekday:
                return

            self._fire(memo, audio_file)
            return

        # MONTHLY

        if frequency == "MONTHLY":
            by_month_day = recurrence.get("byMonthDay", [])

            # Skip if day does not exist in this month
            if day > self._days_in_month(year, month):
                return

            if by_month_day and day not in by_month_day:
                return

            months = (year - start_y) * 12 + (month - start_m)

            if months % interval == 0:
                self._fire(memo, audio_file)
            return


    def _fire(self, memo, audio_file):
        """Trigger and increment count."""
        self._trigger(audio_file)
        Logger.info(
            MODULE,
            "MEMO_TRIGGERED",
            {
                "memoId": memo.get("memoId"),
                "audioFile": audio_file,
                "triggerCount": memo.get("_triggerCount", 0) + 1
            }
        )
        memo["_triggerCount"] = memo.get("_triggerCount", 0) + 1

    def _within_count(self, memo, count):
        """Check count limit."""
        if count is None:
            return True

        current = memo.get("_triggerCount", 0)
        return current < count

    # --------------------------------------------------
    # Date helpers (exact calculation)
    # --------------------------------------------------

    def _days_between(self, y1, m1, d1, y2, m2, d2):
        """Return exact day difference."""
        return self._to_ordinal(y2, m2, d2) - self._to_ordinal(y1, m1, d1)
    
    def _weeks_between(self, y1, m1, d1, y2, m2, d2):
        """Return number of calendar weeks between two dates."""
        o1 = self._to_ordinal(y1, m1, d1)
        o2 = self._to_ordinal(y2, m2, d2)

        # weekday 1=Mon..7=Sun
        w1 = ((o1 + 6) % 7) + 1
        w2 = ((o2 + 6) % 7) + 1

        monday1 = o1 - (w1 - 1)
        monday2 = o2 - (w2 - 1)

        return (monday2 - monday1) // 7

    def _to_ordinal(self, y, m, d):
        """Convert date to ordinal (O(1) exact)."""
        if m < 3:
            y -= 1
            m += 12

        return (
            365 * y
            + y // 4
            - y // 100
            + y // 400
            + (153 * (m - 3) + 2) // 5
            + d
            - 1
        )
    
    def _is_leap(self, year):
        """Return True if leap year."""
        return (
            (year % 4 == 0 and year % 100 != 0)
            or (year % 400 == 0)
        )

    def _days_in_month(self, year, month):
        """Return number of days in month."""
        if month in (1, 3, 5, 7, 8, 10, 12):
            return 31
        if month in (4, 6, 9, 11):
            return 30
        if self._is_leap(year):
            return 29
        return 28

    def _trigger(self, audio_file):
        """Non-blocking audio trigger."""
        if not self.audio:
            return

        if not self.audio.available:
            return

        if self.audio.is_playing():
            return

        path = self.storage.get_audio_path(audio_file)

        try:
            _thread.start_new_thread(
                self.audio.play_wav,
                (path,)
            )
            Logger.info(
                MODULE,
                "AUDIO_TRIGGER_REQUEST",
                {
                    "path": path
                }
            )
        except Exception as e:
            Logger.error(
                MODULE,
                "AUDIO_THREAD_START_FAILED",
                {
                    "path": path,
                    "error": str(e)
                }
            )

    def reload(self):
        """Reload memos from storage."""
        self._load_memos()