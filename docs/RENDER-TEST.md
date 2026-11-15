# Render test: first results (15 Nov 2026)

First run of the week-1 render test (see `docs/PLAN.md`, section 4). The method: cut the
product out of the merchant's photo, lay it **unchanged** on a reusable AI background scene,
export a silent, text-free 1080×1920 mp4.

## What was spent

**$1.66 of the $5 cap** (ledger: `data/spend.csv`).

| Item | Calls | Cost |
|---|---|---|
| Background scene stills (Flux dev) | 4 | $0.21 |
| Background scene videos (Kling 2.5 Turbo Pro, 5 s) | 4 | $1.40 |
| Background removal (BiRefNet v2) | 11 | $0.005 |
| Product selection (SAM 3) | 10 | $0.05 |

**Cost per video once the scene library exists: about $0.005 (≈ SAR 0.02).** That's far below
the SAR ~1 assumed in the plan. One scene costs ~$0.40 and is reused for every order.
Rendering takes 6–13 seconds per video.

## Scene library (4 scenes, committed in `scenes/`)

| Template | Scene | Verdict |
|---|---|---|
| fragrance | 1: black marble pedestal, smoke, gold rim light | Good. Camera stayed still, pedestal stayed empty. |
| fragrance | 2: travertine plinth, silk, palm shadows | Good. |
| coffee | 1: oak counter, blurred cafe | Usable. Counter sits at the very bottom of the frame and a blurred person appeared despite "no people". |
| coffee | 2: dark slate, coffee beans, spotlight, steam | Good. Steam rises behind the cup. |

The scene position (where the product stands) still has to be set by eye per scene
(`placement` in each `scenes/<template>/scene-N.json`). Prompts don't control it reliably.

## Product results (13 stock photos)

| Template | Photos | Worked | Notes |
|---|---|---|---|
| fragrance | 5 | 4 | **The Arabic label ("العربية للعود") came through untouched** and looks like a real ad. The one failure: the photo's top was cropped. |
| coffee | 5 | 1–2 | The method works when the photo is good (side-on white cup). Failures were all down to the photo. |
| real estate | 3 | 3 | Slow drift across the photo. No AI, free. Wide photos lose their sides in 9:16. |

## What we learned

1. **The label guarantee holds.** The product is only cut out, resized, moved and given a light
   colour match. Nothing is redrawn.
2. **Background removal alone is not enough.** It keeps everything in front: hands, flowers,
   pearls. Fixed by adding SAM 3, which keeps only the named object ("perfume bottle") for
   $0.005. BiRefNet supplies the clean edges, SAM 3 decides what counts as the product.
3. **Light matching matters.** A bright product on a dark scene looks pasted on. A mild,
   even colour/brightness adjustment per scene fixes most of it (`grade` in the placement).
4. **The merchant's photo decides the result.** Every coffee failure was a photo problem:
   - shot from directly above (doesn't match a side-on scene),
   - a hand covering the product,
   - the product type didn't match the subject ("coffee cup" vs an Arabic coffee pot).
5. **Real estate needs a different answer for wide photos.** A 9:16 crop of a landscape photo
   loses most of the building.

## What this means for the product

- **Upload screen rules** (shown with example photos): whole product in frame, shot from the side
  or slightly above, no hands, plain background preferred.
- **Ask what the product is** (or pick from a list per template), instead of a fixed subject.
  "coffee cup" missed an Arabic coffee pot.
- **Automatic checks before charging a credit**: product not found, product touching the photo
  edge (already warned by the script), product too small in the photo.
- **More scenes per template**, each with its own placement and light setting.

## Next steps

1. Get 10–20 **real merchant photos with Arabic labels** (open stock has almost none).
2. Blind test with 10 merchants or ad buyers: composite vs fully AI-generated (plan, section 4).
3. Add 3–4 more scenes per template once the blind test passes (~$0.40 each).
4. Real estate: try a blurred-background fill for wide photos, and a Kling version as a premium option.

---

## Update, same day: composites rejected, fully AI-generated video tested

**Verdict on the composites: not good enough.** A product cut out of a photo and placed on
high-quality AI footage looks pasted on; the mismatch makes the whole video look bad.

**Test 2: one fully AI-generated video** (`ads/coffee-machine.mp4`): an espresso machine pouring
a shot, 10 s, 1080p, Flux 2 Pro still animated with Kling v4. Cost **$1.66** ($0.09 still + $1.57 video).
Quality is far better than the composites, but it "looks very AI generated".

**Finishing pass (free, `npm run finish`)** to reduce the AI look, applied to the same clip
(`ads/coffee-machine-finished.mp4`):
- Auto-edit: the single 10 s push-in becomes a 7 s edit of 4 shots (cut, punch-in, speed-up, punch-in).
- Natural look (`looks/natural.json`): saturation down 14%, lifted blacks, rolled-off highlights,
  slight blur against over-sharpening, 1 px colour fringing, vignette, film grain, handheld shake.

**Not done yet (needs paid generation):**
- A phone-footage-style prompt (`ads/coffee-machine-phone.json`), about $0.88 for 5 s. Glossy
  "commercial" prompts are a large part of the AI look.
- A merchant's real product as the first frame, to see whether labels survive full generation.

**Cost if every order is generated from scratch:** about $0.16 per second with Kling v4, so
~$0.80 (SAR 3) for 5 s or ~$1.60 (SAR 6) for 10 s, against SAR 16.7 revenue per video.

Total fal.ai spend so far: $3.32.
