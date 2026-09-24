"""Pure Drive-attempt reconciliation helpers.

Kept free of Google SDK imports so the idempotency contract can be tested in
CI without credentials, network access, or the full AI runtime installed.
"""
import re
from datetime import datetime, timezone

REPORT_ATTEMPT_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")
PROCESSING_RETRY_AFTER_SECONDS = 60 * 60


def validate_report_attempt_id(value: str) -> str:
    if not isinstance(value, str) or not REPORT_ATTEMPT_RE.fullmatch(value):
        raise ValueError("report_attempt_id must be 1-128 safe identifier characters")
    return value


def drive_query_quote(value: str) -> str:
    return value.replace("\\", "\\\\").replace("'", "\\'")


def abandon_attempt(drive, doc_id: str | None, owned_doc_id: str | None) -> bool:
    """Delete only the processing copy created by this request.

    Keeping the ownership token separate from the document ID makes cleanup
    safe when a concurrent request discovers a canonical completed document.
    """
    if not doc_id or doc_id != owned_doc_id:
        return False
    drive.files().delete(fileId=doc_id, supportsAllDrives=True).execute()
    return True


def reconcile_attempt(drive, attempt_id: str, allow_processing: bool = False,
                      return_state: bool = False):
    """Return completed id, or remove stale processing copies.

    A recent processing copy is deliberately rejected: two live requests must
    not race to replace each other's document.  A stale copy is abandoned and
    safely replaced by the caller.
    """
    validate_report_attempt_id(attempt_id)
    key = drive_query_quote(attempt_id)
    result = drive.files().list(
        q=f"trashed = false and appProperties has {{ key='report_attempt_id' and value='{key}' }}",
        fields="files(id,name,appProperties,createdTime,modifiedTime)",
        orderBy="createdTime desc",
        pageSize=20,
    ).execute()
    now = datetime.now(timezone.utc)
    files = sorted(
        result.get("files", []),
        key=lambda item: (item.get("createdTime") or "", item.get("id") or ""),
    )
    for item in files:
        props = item.get("appProperties") or {}
        if props.get("report_state") == "complete":
            return {"id": item["id"], "state": "complete"} if return_state else item["id"]
        if props.get("report_state") != "processing":
            continue
        stamp = props.get("processing_started_at") or item.get("createdTime")
        try:
            age = (now - datetime.fromisoformat(stamp.replace("Z", "+00:00"))).total_seconds()
        except (AttributeError, TypeError, ValueError):
            age = PROCESSING_RETRY_AFTER_SECONDS + 1
        if age >= PROCESSING_RETRY_AFTER_SECONDS:
            drive.files().delete(fileId=item["id"], supportsAllDrives=True).execute()
        else:
            if allow_processing:
                return {"id": item["id"], "state": "processing"} if return_state else item["id"]
            raise RuntimeError("Report attempt is already processing")
    return None