import re
from urllib.parse import urljoin, urlparse


LANDING_URL = "https://rosstat.gov.ru/statistics/price"
ALLOWED_HOST = "rosstat.gov.ru"
WORKBOOK_RE = re.compile(r"ipc_mes_(\d{2})-(\d{4})\.xlsx$", re.IGNORECASE)


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
