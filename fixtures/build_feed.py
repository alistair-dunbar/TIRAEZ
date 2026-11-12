"""Build fixtures/agencies/costa-test-homes/feed.xml (Kyero v3 style) from its listings.json.

listings.json is the source of truth: it is what Part A's listing sync should
produce, and what Part B's mock serves. feed.xml is the raw input Part A parses.

Two rules are built in on purpose, so Part A's sync is tested against them:
- Sold listings are left out of the feed. The sync must mark missing listings as sold.
- Reserved listings carry <status>reserved</status>. Real Kyero feeds have no
  standard status field, so check how each pilot agency marks reservations.

Only Costa Test Homes has a raw feed fixture, because Kyero is its feed type.
The Gulf test agencies get theirs once Part A knows the Property Finder and
Bayut formats from a real agency.

Run:  python3 fixtures/build_feed.py
"""

import json
import pathlib
import xml.etree.ElementTree as ET

HERE = pathlib.Path(__file__).parent / "agencies" / "costa-test-homes"
TYPE_MAP = {
    "villa": "Villa",
    "apartment": "Apartment",
    "penthouse": "Penthouse",
    "townhouse": "Town House",
    "plot": "Plot",
    "other": "Other",
}


def text(parent, tag, value):
    el = ET.SubElement(parent, tag)
    el.text = str(value)
    return el


def build():
    listings = json.loads((HERE / "listings.json").read_text(encoding="utf-8"))
    root = ET.Element("root")
    kyero = ET.SubElement(root, "kyero")
    text(kyero, "feed_version", 3)

    for i, item in enumerate(listings, start=1):
        if item["status"] == "sold":
            continue
        prop = ET.SubElement(root, "property")
        text(prop, "id", 9000 + i)
        text(prop, "date", item["updated_at"].replace("T", " ").rstrip("Z"))
        text(prop, "ref", item["ref"])
        text(prop, "price", item["price"])
        text(prop, "currency", item["currency"])
        text(prop, "price_freq", "sale")
        text(prop, "type", TYPE_MAP[item["type"]])
        text(prop, "town", item["town"])
        text(prop, "province", "Málaga")
        text(prop, "location_detail", item["area"])
        text(prop, "beds", item["beds"])
        text(prop, "baths", item["baths"])
        text(prop, "pool", 1 if any("pool" in f for f in item["features"]) else 0)
        area = ET.SubElement(prop, "surface_area")
        text(area, "built", item["built_m2"])
        if item["plot_m2"] is not None:
            text(area, "plot", item["plot_m2"])
        if item["status"] == "reserved":
            text(prop, "status", "reserved")
        url = ET.SubElement(prop, "url")
        text(url, "en", item["url"])
        desc = ET.SubElement(prop, "desc")
        text(desc, "en", item["summary_en"])
        features = ET.SubElement(prop, "features")
        for f in item["features"]:
            text(features, "feature", f)

    ET.indent(root, space="  ")
    out = HERE / "feed.xml"
    ET.ElementTree(root).write(out, encoding="utf-8", xml_declaration=True)
    print(f"wrote {out} with {len(root.findall('property'))} properties")


if __name__ == "__main__":
    build()
