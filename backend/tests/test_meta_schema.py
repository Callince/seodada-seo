"""JSON-LD (Schema.org) extraction for the Meta analysis tool."""
from __future__ import annotations

from app.integrations.scraper.extractors.meta import extract_meta
from app.integrations.scraper.parser import parse_html
from app.services.page_analysis import _schema_types

_HTML = """
<html lang="en"><head>
  <title>Demo</title>
  <script type="application/ld+json">
    {"@context":"https://schema.org","@type":"Organization","name":"Acme"}
  </script>
  <script type="application/ld+json">
    {"@context":"https://schema.org","@graph":[
      {"@type":"WebSite","name":"Acme"},
      {"@type":["BreadcrumbList","ItemList"],"name":"Crumbs"}
    ]}
  </script>
  <script type="application/ld+json">{ this is not valid json }</script>
</head><body></body></html>
"""


def test_extract_json_ld_blocks_and_types():
    doc = parse_html(_HTML, url="http://x/", final_url="http://x/", status=200, headers={})
    meta = extract_meta(doc)

    # Two valid blocks parsed; the malformed one is skipped, not fatal.
    assert len(meta.json_ld) == 2
    assert meta.json_ld[0]["name"] == "Acme"

    types = _schema_types(meta.json_ld)
    # @graph + list @type flattened and de-duped, order preserved.
    assert types == ["Organization", "WebSite", "BreadcrumbList", "ItemList"]


def test_no_schema_is_empty():
    doc = parse_html("<html><head><title>x</title></head></html>", url="http://x/", final_url="http://x/", status=200, headers={})
    meta = extract_meta(doc)
    assert meta.json_ld == []
    assert _schema_types(meta.json_ld) == []
