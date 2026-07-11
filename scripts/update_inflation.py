import argparse
import hashlib
import json
import ssl
import sys
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Callable
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts.inflation_data import (
    ALLOWED_HOST,
    LANDING_URL,
    InflationDataError,
    discover_latest_workbook,
    merge_months,
    parse_workbook,
    render_ipc_js,
)

ROSSTAT_CA_PATH = (
    Path(__file__).resolve().parents[1]
    / "certs/russian-trusted-sub-ca-2024.pem"
)


def create_rosstat_ssl_context() -> ssl.SSLContext:
    if not ROSSTAT_CA_PATH.is_file():
        raise InflationDataError(
            f"Bundled Rosstat CA certificate is missing: {ROSSTAT_CA_PATH}"
        )
    context = ssl.create_default_context()
    context.load_verify_locations(cafile=str(ROSSTAT_CA_PATH))
    context.verify_flags |= ssl.VERIFY_X509_PARTIAL_CHAIN
    return context


def fetch_url(
    url: str,
    max_bytes: int = 5_000_000,
    opener=None,
) -> bytes:
    _require_rosstat_https(url)
    request = Request(
        url,
        headers={"User-Agent": "asset-allocation-inflation-updater/1.0"},
    )

    try:
        if opener is None:
            response_context = urlopen(
                request,
                timeout=30,
                context=create_rosstat_ssl_context(),
            )
        else:
            response_context = opener(request, timeout=30)

        with response_context as response:
            final_url = response.geturl()
            _require_rosstat_https(final_url)

            content_length = response.headers.get("Content-Length")
            if content_length is not None:
                try:
                    if int(content_length) > max_bytes:
                        raise InflationDataError(
                            f"Rosstat response exceeds {max_bytes} byte size limit"
                        )
                except ValueError as error:
                    raise InflationDataError(
                        f"Rosstat returned invalid Content-Length: {content_length!r}"
                    ) from error

            content = response.read(max_bytes + 1)
            if len(content) > max_bytes:
                raise InflationDataError(
                    f"Rosstat response exceeds {max_bytes} byte size limit"
                )
            return content
    except InflationDataError:
        raise
    except (HTTPError, URLError, OSError) as error:
        raise InflationDataError(f"Could not download {url}: {error}") from error


def _require_rosstat_https(url: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.hostname != ALLOWED_HOST:
        raise InflationDataError(f"Rosstat download used unexpected host: {url}")


def validate_source_freshness(latest_period: str, current_date: date) -> None:
    months_behind = 1 if current_date.day >= 20 else 2
    current_month = current_date.year * 12 + current_date.month - 1
    expected_month = current_month - months_behind
    expected_period = f"{expected_month // 12:04d}-{expected_month % 12 + 1:02d}"

    if latest_period < expected_period:
        raise InflationDataError(
            "Rosstat source is stale: "
            f"latest period is {latest_period}, expected at least {expected_period} "
            f"by {current_date.isoformat()}"
        )


def update_files(
    root: Path,
    fetch: Callable[[str], bytes] = fetch_url,
    retrieved_at: str | None = None,
    current_date: date | None = None,
) -> bool:
    data_path = root / "data/inflation-monthly.json"
    js_path = root / "ipc_data.js"
    existing = {}
    if data_path.exists():
        existing = json.loads(data_path.read_text(encoding="utf-8"))

    landing_html = fetch(LANDING_URL)
    workbook_url = discover_latest_workbook(landing_html)
    workbook_content = fetch(workbook_url)
    official_months = parse_workbook(workbook_content)
    validate_source_freshness(
        official_months[-1]["period"],
        current_date or datetime.now(timezone.utc).date(),
    )
    months, changed = merge_months(existing.get("months", []), official_months)
    if not changed:
        return False

    retrieved_at = retrieved_at or datetime.now(timezone.utc).replace(
        microsecond=0
    ).isoformat().replace("+00:00", "Z")
    payload = {
        "schema_version": 1,
        "source": {
            "agency": "Rosstat",
            "landing_url": LANDING_URL,
            "file_url": workbook_url,
            "retrieved_at": retrieved_at,
            "file_sha256": hashlib.sha256(workbook_content).hexdigest(),
        },
        "latest_period": months[-1]["period"],
        "months": months,
    }

    data_content = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    js_content = render_ipc_js(months)

    _atomic_write(data_path, data_content)
    _atomic_write(js_path, js_content)
    return True


def _atomic_write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + ".tmp")
    temporary.write_text(content, encoding="utf-8")
    temporary.replace(path)


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(
        description="Update the static Russian CPI series from Rosstat"
    )
    parser.add_argument(
        "--root",
        type=Path,
        default=Path(__file__).resolve().parents[1],
        help="Repository root (defaults to the parent of scripts/)",
    )
    arguments = parser.parse_args(argv)

    try:
        changed = update_files(arguments.root)
    except InflationDataError as error:
        print(f"Inflation update failed: {error}", file=sys.stderr)
        return 1

    status = "updated" if changed else "already current"
    print(f"Inflation data {status}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
