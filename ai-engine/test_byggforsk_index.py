"""Tests for the Byggforsk citation gate ("Sitatport").

Run from the repository root:
    python3 -m unittest ai-engine/test_byggforsk_index.py

This gate is the anti-hallucination boundary for technical references: main.py
overwrites every model-supplied reference with valider_referanse()'s verdict, so
an unverifiable citation becomes None rather than reaching the report. The Labs
benchmark's Sitatport dimension scores on top of these semantics, which is why
they are pinned here.

Stdlib-only, like the other engine tests.
"""

import importlib.util
import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("byggforsk", ROOT / "byggforsk_index.py")
byggforsk = importlib.util.module_from_spec(spec)
spec.loader.exec_module(byggforsk)

KNOWN = "711.401"
UNKNOWN = "999.999"


class ValiderReferanseTests(unittest.TestCase):
    def test_known_number_is_normalised_with_its_title(self):
        result = byggforsk.valider_referanse(KNOWN)
        self.assertIsNotNone(result)
        self.assertTrue(result.startswith(f"Byggforsk {KNOWN} "))

    def test_number_outside_the_register_is_rejected(self):
        self.assertIsNone(byggforsk.valider_referanse(UNKNOWN))

    def test_empty_and_missing_values_are_rejected(self):
        for value in (None, "", "   "):
            with self.subTest(value=value):
                self.assertIsNone(byggforsk.valider_referanse(value))

    def test_prose_without_a_number_is_rejected(self):
        self.assertIsNone(byggforsk.valider_referanse("se Byggforsk-serien"))

    def test_subclause_numbers_are_stripped_not_trusted(self):
        # Point/paragraph level cannot be verified without the full-text licence,
        # so it is dropped rather than echoed back into the report.
        result = byggforsk.valider_referanse(f"Byggforsk {KNOWN} pkt 4.2")
        self.assertIsNotNone(result)
        self.assertNotIn("4.2", result)

    def test_already_normalised_reference_round_trips(self):
        once = byggforsk.valider_referanse(KNOWN)
        self.assertEqual(byggforsk.valider_referanse(once), once)

    def test_every_registered_number_validates(self):
        for nummer in byggforsk.BYGGFORSK_INDEX:
            with self.subTest(nummer=nummer):
                self.assertIsNotNone(byggforsk.valider_referanse(nummer))


class FormatIndexTests(unittest.TestCase):
    def test_prompt_block_lists_every_number_and_forbids_inventing_one(self):
        block = byggforsk.format_index_for_prompt()
        for nummer in byggforsk.BYGGFORSK_INDEX:
            self.assertIn(nummer, block)
        self.assertIn("siter KUN fra denne listen", block)

    def test_prompt_block_withholds_routing_keywords(self):
        # emneord are internal routing hints; leaking them would invite the
        # model to pattern-match on them instead of on the evidence.
        block = byggforsk.format_index_for_prompt()
        for _tittel, emneord in byggforsk.BYGGFORSK_INDEX.values():
            for ord_ in emneord:
                if len(ord_) > 6:
                    with self.subTest(emneord=ord_):
                        self.assertNotIn(ord_, block)


if __name__ == "__main__":
    unittest.main()
