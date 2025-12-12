"""Date utility functions for business date calculations."""

from datetime import datetime, timedelta


def is_holiday(date_input: str | datetime) -> bool:
    """
    Check if a given date is a U.S. holiday.

    Holidays checked:
    - New Year's Day (January 1)
    - Memorial Day (Last Monday of May)
    - Independence Day (July 4)
    - Labor Day (First Monday of September)
    - Thanksgiving Day (Fourth Thursday of November)
    - Day After Thanksgiving (Fourth Friday of November)
    - Christmas Day (December 25)

    Args:
        date_input: Date as string in MM/DD/YYYY format or datetime object

    Returns:
        bool: True if the date is a holiday, False otherwise

    Examples:
        >>> is_holiday("01/01/2025")  # New Year's Day
        True
        >>> is_holiday("07/04/2025")  # Independence Day
        True
        >>> is_holiday("11/27/2025")  # Thanksgiving
        True
        >>> is_holiday("11/28/2025")  # Day After Thanksgiving
        True
        >>> is_holiday("11/26/2025")  # Regular Tuesday
        False
    """
    # Parse input if string
    date = datetime.strptime(date_input, "%m/%d/%Y") if isinstance(date_input, str) else date_input

    month = date.month
    day = date.day
    year = date.year

    # New Year's Day (January 1)
    if month == 1 and day == 1:
        return True

    # Independence Day (July 4)
    if month == 7 and day == 4:
        return True

    # Christmas Day (December 25)
    if month == 12 and day == 25:
        return True

    # Memorial Day (Last Monday of May)
    if month == 5:
        # Find last Monday of May
        last_day = datetime(year, 5, 31)
        last_monday = last_day - timedelta(days=(last_day.weekday() - 0) % 7)
        if date.date() == last_monday.date():
            return True

    # Labor Day (First Monday of September)
    if month == 9:
        # Find first Monday of September
        first_day = datetime(year, 9, 1)
        first_monday = first_day + timedelta(days=(0 - first_day.weekday()) % 7)
        if date.date() == first_monday.date():
            return True

    # Thanksgiving Day (Fourth Thursday of November)
    if month == 11:
        # Find fourth Thursday of November
        first_day = datetime(year, 11, 1)
        # Thursday is weekday 3
        first_thursday = first_day + timedelta(days=(3 - first_day.weekday()) % 7)
        fourth_thursday = first_thursday + timedelta(weeks=3)
        if date.date() == fourth_thursday.date():
            return True

        # Day After Thanksgiving (Fourth Friday of November)
        day_after_thanksgiving = fourth_thursday + timedelta(days=1)
        if date.date() == day_after_thanksgiving.date():
            return True

    return False


def get_previous_business_date(date_input: str | datetime) -> str:
    """
    Get the previous business date (skips weekends and holidays).

    Given Monday, returns Friday.
    Given Tuesday-Friday, returns the previous day.
    Given Saturday, returns Friday.
    Given Sunday, returns Friday.
    If the result is a holiday, continues to the previous day.

    Args:
        date_input: Date as string in MM/DD/YYYY format or datetime object

    Returns:
        str: Previous business date in MM/DD/YYYY format

    Examples:
        >>> get_previous_business_date("11/18/2025")  # Monday
        "11/14/2025"  # Friday
        >>> get_previous_business_date("11/19/2025")  # Tuesday
        "11/18/2025"  # Monday
    """
    # Parse input if string
    date = datetime.strptime(date_input, "%m/%d/%Y") if isinstance(date_input, str) else date_input

    # Get previous day
    previous_day = date - timedelta(days=1)

    # If previous day is Saturday (5), go back to Friday
    if previous_day.weekday() == 5:
        previous_day = previous_day - timedelta(days=1)
    # If previous day is Sunday (6), go back to Friday
    elif previous_day.weekday() == 6:
        previous_day = previous_day - timedelta(days=2)

    # If previous day is a holiday, go back one more day
    if is_holiday(previous_day):
        previous_day = previous_day - timedelta(days=1)
        # Recursively check for weekends/holidays
        return get_previous_business_date(previous_day)

    return previous_day.strftime("%m/%d/%Y")


def get_next_business_date(date_input: str | datetime) -> str:
    """
    Get the next business date (skips weekends and holidays).

    Given Friday, returns Monday.
    Given Monday-Thursday, returns the next day.
    Given Saturday, returns Monday.
    Given Sunday, returns Monday.
    If the result is a holiday, continues to the next day.

    Args:
        date_input: Date as string in MM/DD/YYYY format or datetime object

    Returns:
        str: Next business date in MM/DD/YYYY format

    Examples:
        >>> get_next_business_date("11/15/2025")  # Friday
        "11/18/2025"  # Monday
        >>> get_next_business_date("11/18/2025")  # Monday
        "11/19/2025"  # Tuesday
    """
    # Parse input if string
    date = datetime.strptime(date_input, "%m/%d/%Y") if isinstance(date_input, str) else date_input

    # Get next day
    next_day = date + timedelta(days=1)

    # If next day is Saturday (5), go forward to Monday
    if next_day.weekday() == 5:
        next_day = next_day + timedelta(days=2)
    # If next day is Sunday (6), go forward to Monday
    elif next_day.weekday() == 6:
        next_day = next_day + timedelta(days=1)

    # If next day is a holiday, go forward one more day
    if is_holiday(next_day):
        next_day = next_day + timedelta(days=1)
        # Recursively check for weekends/holidays
        return get_next_business_date(next_day)

    return next_day.strftime("%m/%d/%Y")


__all__ = ["get_previous_business_date", "get_next_business_date", "is_holiday"]
