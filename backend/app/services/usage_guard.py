import datetime

DAILY_CALL_LIMIT = 50  # generous for personal use; adjust if it's ever too low

_call_count = 0
_count_date = datetime.date.today()


def check_and_increment():
    """Raises RuntimeError if the daily call limit has been reached.
    Resets the counter automatically when the date changes."""
    global _call_count, _count_date

    today = datetime.date.today()
    if today != _count_date:
        _call_count = 0
        _count_date = today

    if _call_count >= DAILY_CALL_LIMIT:
        raise RuntimeError(
            f"Daily API call limit reached ({DAILY_CALL_LIMIT} calls). "
            f"This resets at midnight. If you need more today, raise "
            f"DAILY_CALL_LIMIT in app/services/usage_guard.py."
        )

    _call_count += 1


def current_count() -> int:
    return _call_count
