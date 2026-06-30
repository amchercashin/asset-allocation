import re
from io import BytesIO
from numbers import Real
from urllib.parse import urljoin, urlparse

from openpyxl import load_workbook


LANDING_URL = "https://rosstat.gov.ru/statistics/price"
ALLOWED_HOST = "rosstat.gov.ru"
WORKBOOK_RE = re.compile(r"ipc_mes_(\d{2})-(\d{4})\.xlsx$", re.IGNORECASE)
START_PERIOD = "2003-02"
MONTHS_RU = (
    "январь",
    "февраль",
    "март",
    "апрель",
    "май",
    "июнь",
    "июль",
    "август",
    "сентябрь",
    "октябрь",
    "ноябрь",
    "декабрь",
)


class InflationDataError(RuntimeError):
    pass


def discover_latest_workbook(html: bytes) -> str:
    text = html.decode("utf-8", errors="replace")
    candidates = []

    for href in re.findall(r'href=["\']([^"\']+)["\']', text, re.IGNORECASE):
        url = urljoin(LANDING_URL, href)
        parsed = urlparse(url)
        match = WORKBOOK_RE.search(parsed.path)
        if parsed.scheme != "https" or parsed.hostname != ALLOWED_HOST or not match:
            continue

        month, year = map(int, match.groups())
        if 1 <= month <= 12:
            candidates.append(((year, month), url))

    if not candidates:
        raise InflationDataError("Rosstat workbook link was not found")

    return max(candidates)[1]


def parse_workbook(content: bytes) -> list[dict]:
    try:
        workbook = load_workbook(BytesIO(content), read_only=True, data_only=True)
    except Exception as error:
        raise InflationDataError(f"Could not open Rosstat workbook: {error}") from error

    try:
        if "01" not in workbook.sheetnames:
            raise InflationDataError("Rosstat workbook does not contain sheet 01")

        rows = list(workbook["01"].iter_rows(values_only=True))
        year_columns = _find_year_columns(rows)
        month_rows = _find_month_rows(rows)
        records = []
        series_ended = False

        for column, year in sorted(year_columns.items(), key=lambda item: item[1]):
            if year < 2003:
                continue
            for month_number, month_name in enumerate(MONTHS_RU, start=1):
                period = f"{year:04d}-{month_number:02d}"
                if period < START_PERIOD:
                    continue

                row = month_rows[month_name]
                value = row[column] if column < len(row) else None
                if value is None:
                    series_ended = True
                    continue
                if series_ended:
                    raise InflationDataError(
                        f"Rosstat workbook has data after a missing month at {period}"
                    )
                if isinstance(value, bool) or not isinstance(value, Real):
                    raise InflationDataError(
                        f"Rosstat value for {period} is not numeric: {value!r}"
                    )

                numeric = round(float(value), 2)
                if not 80 <= numeric <= 120:
                    raise InflationDataError(
                        f"Rosstat value for {period} is outside 80..120: {numeric}"
                    )
                records.append(
                    {
                        "period": period,
                        "index_to_previous_month": numeric,
                    }
                )

        if not records:
            raise InflationDataError("Rosstat workbook contains no monthly CPI data")
        return records
    finally:
        workbook.close()


def _find_year_columns(rows: list[tuple]) -> dict[int, int]:
    best = {}
    for row in rows:
        candidate = {}
        for column, value in enumerate(row):
            if isinstance(value, bool) or not isinstance(value, Real):
                continue
            year = int(value)
            if value == year and 1900 <= year <= 2200:
                if year in candidate.values():
                    raise InflationDataError(f"Duplicate year {year} in Rosstat workbook")
                candidate[column] = year
        if len(candidate) > len(best):
            best = candidate

    if not best:
        raise InflationDataError("Could not find year headers in Rosstat workbook")
    return best


def _find_month_rows(rows: list[tuple]) -> dict[str, tuple]:
    found = {}
    for row in rows:
        for value in row:
            if not isinstance(value, str):
                continue
            month = value.strip().lower()
            if month in MONTHS_RU and month not in found:
                found[month] = row
                break

    missing = [month for month in MONTHS_RU if month not in found]
    if missing:
        raise InflationDataError(
            "Could not find month rows in Rosstat workbook: " + ", ".join(missing)
        )
    return found
