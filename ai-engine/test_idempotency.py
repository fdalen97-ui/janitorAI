import unittest
from datetime import datetime, timedelta, timezone
from report_idempotency import (
    PROCESSING_RETRY_AFTER_SECONDS,
    abandon_attempt,
    reconcile_attempt,
    validate_report_attempt_id,
)


class FakeRequest:
    def __init__(self, value):
        self.value = value

    def execute(self):
        return self.value


class FakeFiles:
    def __init__(self, files):
        self.items = files
        self.deleted = []
        self.query = None

    def list(self, **kwargs):
        self.query = kwargs["q"]
        return FakeRequest({"files": self.items})

    def delete(self, **kwargs):
        self.deleted.append(kwargs["fileId"])
        self.items[:] = [item for item in self.items if item.get("id") != kwargs["fileId"]]
        return FakeRequest({})


class FakeDrive:
    def __init__(self, files):
        self._files = FakeFiles(files)

    def files(self):
        return self._files


class AttemptIdempotencyTests(unittest.TestCase):
    def test_attempt_key_validation(self):
        self.assertEqual(validate_report_attempt_id("batch-1.A"), "batch-1.A")
        for value in ("", "bad key", "quote'key", "x" * 129):
            with self.assertRaises(ValueError):
                validate_report_attempt_id(value)

    def test_completed_file_is_reused(self):
        drive = FakeDrive([{"id": "doc-1", "appProperties": {
            "report_attempt_id": "attempt", "report_state": "complete",
        }}])
        self.assertEqual(reconcile_attempt(drive, "attempt"), "doc-1")
        self.assertEqual(drive._files.deleted, [])

    def test_stale_processing_copy_is_deleted(self):
        stale = (datetime.now(timezone.utc) -
                 timedelta(seconds=PROCESSING_RETRY_AFTER_SECONDS + 1)).isoformat()
        drive = FakeDrive([{"id": "orphan", "createdTime": stale,
                            "appProperties": {"report_state": "processing"}}])
        self.assertIsNone(reconcile_attempt(drive, "attempt"))
        self.assertEqual(drive._files.deleted, ["orphan"])

    def test_recent_processing_copy_is_not_replaced(self):
        recent = datetime.now(timezone.utc).isoformat()
        drive = FakeDrive([{"id": "live", "createdTime": recent,
                            "appProperties": {"report_state": "processing"}}])
        with self.assertRaises(RuntimeError):
            reconcile_attempt(drive, "attempt")
        self.assertEqual(drive._files.deleted, [])

    def test_oldest_copy_is_canonical_for_duplicate_processing_files(self):
        now = datetime.now(timezone.utc)
        files = [
            {"id": "old", "createdTime": (now - timedelta(minutes=2)).isoformat(),
             "appProperties": {"report_state": "processing"}},
            {"id": "new", "createdTime": now.isoformat(),
             "appProperties": {"report_state": "processing"}},
        ]
        drive = FakeDrive(files)
        self.assertEqual(
            reconcile_attempt(drive, "attempt", allow_processing=True, return_state=True),
            {"id": "old", "state": "processing"},
        )

    def test_analysis_abandonment_removes_processing_attempt_and_allows_retry(self):
        recent = datetime.now(timezone.utc).isoformat()
        drive = FakeDrive([{"id": "owned", "createdTime": recent,
                            "appProperties": {
                                "report_attempt_id": "attempt",
                                "report_state": "processing",
                            }}])
        self.assertTrue(abandon_attempt(drive, "owned", "owned"))
        self.assertIsNone(reconcile_attempt(drive, "attempt"))

    def test_abandonment_never_deletes_unowned_canonical(self):
        drive = FakeDrive([{"id": "canonical", "appProperties": {
            "report_attempt_id": "attempt", "report_state": "complete",
        }}])
        self.assertFalse(abandon_attempt(drive, "canonical", "request-copy"))
        self.assertEqual(drive._files.deleted, [])


if __name__ == "__main__":
    unittest.main()