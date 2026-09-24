"""Tests for the prompt block registry.

Run from the repository root:
    python3 -m unittest ai-engine/test_prompt_blocks.py

The golden test is the gate on the core/blocks refactor: with the production
default block set, the rendered prompt must stay byte-identical to
testdata/prompt_baseline.txt, which was captured from the pre-refactor code.
Regenerating that baseline is only legitimate together with a PROMPT_VERSION
bump and a fresh run of the validation battery (docs/valideringscaser.md).

Like test_prompt_signals.py, this loads prompt.py directly so it runs without
the AI service dependencies installed.
"""

import importlib.util
import pathlib
import sys
import unittest


ROOT = pathlib.Path(__file__).resolve().parent
# main_prompt() imports byggforsk_index as a sibling, exactly as it does in
# production (cwd = ai-engine); make that resolvable when loading by path.
sys.path.insert(0, str(ROOT))
spec = importlib.util.spec_from_file_location("water_prompt", ROOT / "prompt.py")
prompt = importlib.util.module_from_spec(spec)
spec.loader.exec_module(prompt)

BASELINE = ROOT / "testdata" / "prompt_baseline.txt"

PROJECT = {
    "name": "VALIDERING 02 - Midtgjerdinga-tvillingen",
    "inspectionDate": "2026-01-15",
    "inspector": "Sigurd",
    "projectDescriptionText": "Fuktmerker i stue mot yttervegg under terreng.",
    "projectDescriptionTranscription": "Fuktmerker i stue mot yttervegg under terreng, ca 40 cm opp fra gulv.",
    "notes": [
        {
            "room": "Stue",
            "text": "Morke fuktmerker nederst pa vegg mot terreng.",
            "transcription": "Morke fuktmerker nederst pa vegg mot terreng, ca 40 cm opp.",
            "photos": [
                {"caption": "Naerbilde av fuktmerke ved gulvlist"},
                {"caption": "Oversiktsbilde vegg mot terreng"},
            ],
        },
        {
            "room": "Stue",
            "text": "Ror til utekran trykktestet - ingen drypp, bunnsvill torr.",
            "photos": [],
        },
        {"room": "", "text": "", "transcription": "", "photos": []},
    ],
}
REPORT_META = {"buildings": [{"buildingYear": "1965"}], "inspectionDate": "2026-01-15"}
EMPTY_META = {"buildings": [{"buildingYear": "ukjent"}]}
SUMMER_META = {"buildings": [{"buildingYear": "1999"}], "inspectionDate": "2026-07-02"}


def render_all() -> str:
    """Must mirror the section list in testdata/prompt_baseline.txt exactly."""
    sections = [
        ("system_prompt()", prompt.system_prompt()),
        ("main_prompt()", prompt.main_prompt()),
        ("build_case_signals(REPORT_META, PROJECT)", prompt.build_case_signals(REPORT_META, PROJECT)),
        ("build_case_signals(EMPTY_META, {})", prompt.build_case_signals(EMPTY_META, {})),
        ("build_case_signals(SUMMER_META, {})", prompt.build_case_signals(SUMMER_META, {})),
        ("build_inspector_context(PROJECT, REPORT_META)", prompt.build_inspector_context(PROJECT, REPORT_META)),
        ("build_inspector_context({}, {})", prompt.build_inspector_context({}, {})),
        ("build_inspector_context(PROJECT, {})", prompt.build_inspector_context(PROJECT, {})),
    ]
    out = []
    for name, text in sections:
        out.append("=" * 78)
        out.append(f"### SECTION: {name}")
        out.append("=" * 78)
        out.append(text)
        out.append("")
    return "\n".join(out)


class GoldenDefaultTests(unittest.TestCase):
    def test_default_composition_matches_baseline(self):
        expected = BASELINE.read_text(encoding="utf-8")
        self.assertEqual(
            render_all(),
            expected,
            "Default prompt composition drifted from testdata/prompt_baseline.txt. "
            "If the change is intentional, bump PROMPT_VERSION, regenerate the "
            "baseline, and re-run docs/valideringscaser.md.",
        )

    def test_every_block_defaults_on(self):
        # Production today injects everything; a block defaulting off would
        # silently change live output relative to the baseline.
        self.assertEqual(prompt.default_blocks(), set(prompt.BLOCKS))


class DependencyResolutionTests(unittest.TestCase):
    def test_none_means_production_default(self):
        self.assertEqual(prompt.resolve_enabled(None), prompt.default_blocks())

    def test_unknown_ids_are_ignored(self):
        self.assertEqual(prompt.resolve_enabled(["femkilder", "nope"]), {"femkilder"})

    def test_signalbruk_drops_without_any_signal(self):
        active = prompt.resolve_enabled(["inspektorkontekst", "signalbruk"])
        self.assertNotIn("signalbruk", active)

    def test_signalbruk_survives_with_one_signal(self):
        active = prompt.resolve_enabled(["inspektorkontekst", "signal_sesong", "signalbruk"])
        self.assertIn("signalbruk", active)

    def test_dropping_inspektorkontekst_cascades_to_signals_and_signalbruk(self):
        # signal_* require inspektorkontekst, and signalbruk requires a signal —
        # so the whole chain must fall out, not just the direct dependents.
        active = prompt.resolve_enabled(["signal_byggeaar", "signal_sesong", "signalbruk"])
        self.assertEqual(active, set())


class BlockEffectTests(unittest.TestCase):
    def test_femkilder_off_removes_checklist_and_rewords_step_four(self):
        enabled = prompt.default_blocks() - {"femkilder"}
        mission = prompt.main_prompt(enabled)
        system = prompt.system_prompt(enabled)
        self.assertNotIn("TEKNISK SJEKKLISTE", mission)
        self.assertNotIn("se TEKNISK SJEKKLISTE", system)
        self.assertIn("de aktuelle vannskadekildene", system)

    def test_femkilder_on_references_checklist_from_step_four(self):
        self.assertIn("se TEKNISK SJEKKLISTE", prompt.system_prompt())

    def test_byggforsk_register_off_switches_citation_requirement(self):
        enabled = prompt.default_blocks() - {"byggforsk_register"}
        mission = prompt.main_prompt(enabled)
        self.assertNotIn("GODKJENTE BYGGFORSK-REFERANSER", mission)
        self.assertIn("La `technical_reference` stå tom", mission)

    def test_foto_manifest_off_drops_source_photo_index_instruction(self):
        enabled = prompt.default_blocks() - {"foto_manifest"}
        self.assertNotIn("source_photo_index", prompt.main_prompt(enabled))

    def test_signals_can_be_toggled_independently(self):
        only_year = prompt.build_case_signals(
            REPORT_META, PROJECT, {"inspektorkontekst", "signal_byggeaar"}
        )
        self.assertIn("før 1970", only_year)
        self.assertNotIn("vinterhalvåret", only_year)

        only_season = prompt.build_case_signals(
            REPORT_META, PROJECT, {"inspektorkontekst", "signal_sesong"}
        )
        self.assertIn("vinterhalvåret", only_season)
        self.assertNotIn("før 1970", only_season)

    def test_inspektorkontekst_off_returns_empty_context(self):
        enabled = prompt.default_blocks() - {"inspektorkontekst"}
        self.assertEqual(prompt.build_inspector_context(PROJECT, REPORT_META, enabled), "")

    def test_system_prompt_keeps_core_invariants_under_every_toggle(self):
        # The never-choose-cause invariant and the schema contract are core: no
        # combination of block toggles may remove them.
        for drop in list(prompt.BLOCKS) + [None]:
            enabled = prompt.default_blocks() - ({drop} if drop else set())
            system = prompt.system_prompt(enabled)
            with self.subTest(dropped=drop):
                self.assertIn("HYPOTESE ≠ KONKLUSJON", system)
                self.assertIn("AVKREFTENDE FUNN ER HARDE BEVIS", system)
                self.assertIn("UVERIFISERT KILDE = MISTENKT", system)
                self.assertIn("bruk USIKKER", system)
                self.assertIn("DamageAnalysis", system)


class ResolvePromptTests(unittest.TestCase):
    def test_sha256_is_stable_for_same_inputs(self):
        a = prompt.resolve_prompt(None, PROJECT, REPORT_META)
        b = prompt.resolve_prompt(None, PROJECT, REPORT_META)
        self.assertEqual(a["sha256"], b["sha256"])

    def test_sha256_changes_when_a_block_is_dropped(self):
        full = prompt.resolve_prompt(None, PROJECT, REPORT_META)
        reduced = prompt.resolve_prompt(
            prompt.default_blocks() - {"femkilder"}, PROJECT, REPORT_META
        )
        self.assertNotEqual(full["sha256"], reduced["sha256"])

    def test_payload_shape(self):
        resolved = prompt.resolve_prompt(None, PROJECT, REPORT_META)
        self.assertEqual(
            set(resolved),
            {"system", "mission", "context", "blocks_enabled", "prompt_version", "sha256"},
        )
        self.assertEqual(resolved["prompt_version"], prompt.PROMPT_VERSION)
        self.assertEqual(resolved["blocks_enabled"], sorted(prompt.default_blocks()))


class ManifestTests(unittest.TestCase):
    def test_manifest_covers_every_block_with_ui_fields(self):
        manifest = prompt.blocks_manifest()
        self.assertEqual({b["id"] for b in manifest}, set(prompt.BLOCKS))
        for entry in manifest:
            with self.subTest(block=entry["id"]):
                self.assertTrue(entry["label"])
                self.assertIn(
                    entry["kind"], {"system", "mission", "context", "signal", "upload"}
                )
                self.assertIsInstance(entry["requires"], list)
                self.assertIsInstance(entry["requiresAny"], list)

    def test_declared_dependencies_reference_real_blocks(self):
        for block in prompt.BLOCKS.values():
            for dep in tuple(block.requires) + tuple(block.requires_any):
                with self.subTest(block=block.id, dep=dep):
                    self.assertIn(dep, prompt.BLOCKS)


if __name__ == "__main__":
    # Intentional prompt changes: regenerate with
    #   python3 ai-engine/test_prompt_blocks.py --update-baseline
    # then bump PROMPT_VERSION and re-run docs/valideringscaser.md.
    if "--update-baseline" in sys.argv:
        sys.argv.remove("--update-baseline")
        BASELINE.write_text(render_all(), encoding="utf-8")
        print(f"baseline updated: {BASELINE}")
    else:
        unittest.main()
