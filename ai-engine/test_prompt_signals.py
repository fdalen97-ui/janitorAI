"""Focused tests for deterministic water-damage context signals.

Run from the repository root:
    python3 -m unittest ai-engine/test_prompt_signals.py

The prompt module only needs the Python standard library for these helpers, so
these checks remain runnable in environments where the AI service dependencies
are intentionally not installed.
"""

import importlib.util
import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("water_prompt", ROOT / "prompt.py")
prompt = importlib.util.module_from_spec(spec)
spec.loader.exec_module(prompt)


class PromptSignalTests(unittest.TestCase):
    def test_building_year_and_winter_signals(self):
        signals = prompt.build_case_signals(
            {
                "buildings": [{"buildingYear": "1965"}],
                "inspectionDate": "2026-01-15",
            }
        )
        self.assertIn("før 1970", signals)
        self.assertIn("før 1979", signals)
        self.assertIn("vinterhalvåret", signals)

    def test_malformed_metadata_is_ignored(self):
        self.assertEqual(
            prompt.build_case_signals(
                {
                    "buildings": [
                        {"buildingYear": "ukjent"},
                        {"buildingYear": "1700"},
                        {"buildingYear": "2200"},
                    ],
                    "inspectionDate": "not-a-date",
                }
            ),
            "",
        )

    def test_project_date_is_used_when_report_date_is_missing(self):
        signals = prompt.build_case_signals(
            {"buildings": []},
            {"inspectionDate": "2026-07-01"},
        )
        self.assertIn("sommerhalvåret", signals)


if __name__ == "__main__":
    unittest.main()