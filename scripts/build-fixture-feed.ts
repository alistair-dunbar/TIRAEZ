// Writes fixtures/feed.xml (Kyero v3) from fixtures/listings.json, so the two never drift.
//   node --import tsx scripts/build-fixture-feed.ts
// Sold listings are left out: in a Kyero feed, a listing that disappears has been sold or withdrawn.
// Kyero has no "reserved" flag, so reserved listings appear as normal; that status is kept on our side.
import { readFileSync, writeFileSync } from "node:fs";
import { repoPath } from "../src/data.ts";
import type { ListingRecord } from "../src/api/types.ts";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const listings = JSON.parse(readFileSync(repoPath("fixtures/listings.json"), "utf8")) as ListingRecord[];

const properties = listings
  .filter((l) => l.status !== "sold")
  .map((l, i) => {
    const plot = l.plot_m2 === null ? "" : `\n      <plot>${l.plot_m2}</plot>`;
    return `  <property>
    <id>${100 + i + 1}</id>
    <date>${l.updated_at.slice(0, 19).replace("T", " ")}</date>
    <ref>${esc(l.ref)}</ref>
    <price>${l.price_eur}</price>
    <currency>EUR</currency>
    <price_freq>sale</price_freq>
    <new_build>0</new_build>
    <type>${l.type}</type>
    <town>${esc(l.town)}</town>
    <province>${esc(l.province)}</province>
    <location_detail>${esc(l.area ?? "")}</location_detail>
    <beds>${l.beds}</beds>
    <baths>${l.baths}</baths>
    <pool>${l.pool ? 1 : 0}</pool>
    <surface_area>
      <built>${l.built_m2}</built>${plot}
    </surface_area>
    <url>
      <en>${esc(l.url)}</en>
    </url>
    <title>
      <en>${esc(l.title)}</en>
    </title>
    <desc>
      <en>${esc(l.description_en)}</en>
    </desc>
    <features>
${l.features.map((f) => `      <feature>${esc(f)}</feature>`).join("\n")}
    </features>
  </property>`;
  });

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Test fixture for Costa Test Homes (fictional). Generated from fixtures/listings.json by scripts/build-fixture-feed.ts. -->
<root>
  <kyero>
    <feed_version>3</feed_version>
  </kyero>
${properties.join("\n")}
</root>
`;
writeFileSync(repoPath("fixtures/feed.xml"), xml);
console.log(`Wrote fixtures/feed.xml with ${properties.length} properties.`);
