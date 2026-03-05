from django.test import SimpleTestCase

from pim.ai_service import _normalize_primary_category


class AIServiceCategoryNormalizationTests(SimpleTestCase):
    def test_maps_common_aliases_to_canonical_category(self):
        self.assertEqual(_normalize_primary_category("Dildos"), "Dildo")
        self.assertEqual(
            _normalize_primary_category("Cock Rings and Enhancers"),
            "Cock Rings & Enhancers",
        )
        self.assertEqual(_normalize_primary_category("strap ons"), "Strap-Ons")
        self.assertEqual(_normalize_primary_category("buttplay"), "Butt Plugs")

    def test_handles_case_whitespace_and_symbols(self):
        self.assertEqual(_normalize_primary_category("  VIBRATORS  "), "Vibrators")
        self.assertEqual(_normalize_primary_category("half body sex-doll"), "Half Body Sex Doll")
        self.assertEqual(_normalize_primary_category("FULL BODY SEX DOLL"), "Full Body Sex Doll")

    def test_falls_back_to_other_for_unknown_or_empty_values(self):
        self.assertEqual(_normalize_primary_category("unknown-category"), "other")
        self.assertEqual(_normalize_primary_category(""), "other")
        self.assertEqual(_normalize_primary_category(None), "other")
