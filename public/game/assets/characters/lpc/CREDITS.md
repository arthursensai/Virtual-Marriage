# LPC Asset Credits — Virtual Marriage

This project uses a small, curated subset (108 files, ~4.5MB) of the
**Universal LPC Spritesheet Character Generator** assets — not the full
~388MB bundle.

**Canonical source (verified 2026‑09‑21):**
https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator
Live generator: https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/
(`lpc.4wall.ai`, which this project's assets were originally pulled from, is
another public deployment of the same generator/asset set.)

## License framework (per the canonical repo's current README)
Every image in `spritesheets/` is licensed under one or more of:
- **CC0** — public domain, attribution not required
- **CC-BY-SA 4.0** — must credit authors; derivatives must stay CC-BY-SA 4.0+
- **CC-BY 4.0** — must credit authors
- **OGA-BY 3.0** — must credit authors; may be used in DRM-protected games
- **GPL 3.0** — derivatives must stay GPL 3.0+

The per-file table below records the license tags exactly as they appear in
the `CREDITS.csv` bundled in this folder (some show the older `3.0` wording
for CC-BY / CC-BY-SA rather than the `4.0` the canonical repo now uses
project-wide — the canonical repo's full 3.8MB `CREDITS.csv` could not be
downloaded directly in this environment, see note at the bottom). Where in
doubt, treat CC-BY/CC-BY-SA tags below as their current 4.0 equivalents.

| Asset used | Authors | License(s) (as recorded) | Source |
|---|---|---|---|
| `body/bodies/male` | bluecarrot16, JaidynReiman, Benjamin K. Smith, Evert, Eliza Wyatt (ElizaWy), TheraHedwig, MuffinElZangano, Durrani, Johannes Sjölund (wulax), Stephen Challener (Redshrike) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 | opengameart.org/content/lpc-character-bases |
| `body/bodies/female` | Benjamin K. Smith, bluecarrot16, TheraHedwig, Evert, MuffinElZangano, Durrani, Pierre Vigier, ElizaWy, Matthew Krohn, Johannes Sjölund, Stephen Challener | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 | opengameart.org/content/lpc-character-bases |
| `hair/bangs`, `hair/bangs_bun`, `hair/bob`, `hair/curly_short`, `hair/balding` | JaidynReiman (and base LPC hair contributors) | OGA-BY 3.0+, CC-BY 3.0+, CC-BY-SA 3.0, GPL 3.0 | opengameart.org/content/lpc-1-hairstyle-2-hair-extensions-3-previously-unofficially-released-hairstyles |
| `torso/aprons/suspenders/male` (outfit: *suit*) | ElizaWy, JaidynReiman | OGA-BY 3.0 | github.com/ElizaWy/LPC, opengameart.org/content/lpc-expanded-sit-run-jump-more |
| `torso/aprons/overalls/male` (outfit: *jellaba* / *kaftan*, male) | ElizaWy, bluecarrot16, JaidynReiman | OGA-BY 3.0, GPL 3.0 | opengameart.org/content/lpc-revised-character-basics, opengameart.org/content/lpc-clothing-updates |
| `dress/kimono/normal/universal/female` (outfit: *gown*) | JaidynReiman, Stephen Challener (Redshrike), Johannes Sjölund (wulax) | OGA-BY 3.0+, CC-BY 3.0+, GPL 3.0 | opengameart.org/content/lpc-kimono-relm |
| `dress/kimono/sleeves_oversize/universal/female` (outfit: *kaftan*, female) | JaidynReiman, Stephen Challener (Redshrike), Johannes Sjölund (wulax) | OGA-BY 3.0+, CC-BY 3.0+, GPL 3.0 | opengameart.org/content/lpc-kimono-relm |
| `dress/bodice/female` (outfit: *mermaid*) | bluecarrot16, Matthew Krohn (makrohn), Lanea Zimmerman (Sharm) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 | opengameart.org/content/lpc-dress-in-combat-poses, opengameart.org/content/lpc-clothing-updates |
| `feet/boots/basic/male`, `feet/shoes/basic/thin` | base LPC character/clothing contributors (see `CREDITS.csv`) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 | opengameart.org/content/lpc-character-bases |

## Fallback project-wide attribution statement
If you don't want to show the full `CREDITS.csv` on a credits screen, the
canonical repo's README recommends this statement instead (reproduced here
verbatim from the repo, as it is provided by the project explicitly for
reuse — not creative content):

> Sprites by: Johannes Sjölund (wulax), Michael Whitlock (bigbeargames), Matthew Krohn (makrohn), Nila122, David Conway Jr. (JaidynReiman), Carlo Enrico Victoria (Nemisys), Thane Brimhall (pennomi), laetissima, bluecarrot16, Luke Mehl, Benjamin K. Smith (BenCreating), MuffinElZangano, Durrani, kheftel, Stephen Challener (Redshrike), William.Thompsonj, Marcel van de Steeg (MadMarcel), TheraHedwig, Evert, Pierre Vigier (pvigier), Eliza Wyatt (ElizaWy), Sander Frenken (castelonia), dalonedrau, Lanea Zimmerman (Sharm), Manuel Riecke (MrBeast), Barbara Riviera, Joe White, Mandi Paugh, Shaun Williams, Daniel Eddeland (daneeklu), Emilio J. Sanchez-Sierra, drjamgo, gr3yh47, tskaufma, Fabzy, Yamilian, Skorpio, Tuomo Untinen (reemax), Tracy, thecilekli, LordNeo, Stafford McIntyre, PlatForge project, DCSS authors, DarkwallLKE, Charles Sanchez (CharlesGabriel), Radomir Dopieralski, macmanmatty, Cobra Hubbard (BlueVortexGames), Inboxninja, kcilds/Rocetti/Eredah, Napsio (Vitruvian Studio), The Foreman, AntumDeluge
> Sprites contributed as part of the Liberated Pixel Cup project from OpenGameArt.org: http://opengameart.org/content/lpc-collection
> License: Creative Commons Attribution-ShareAlike (CC-BY-SA) http://creativecommons.org/licenses/by-sa/
> Detailed credits: `CREDITS.csv` in this folder, or https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator/blob/master/CREDITS.csv

## Known gaps in this subset (see comments at the top of `lib/lpc/manifest.ts`)
- No accessory art (veil, tiara, bowtie, tarbouche, shades, flower, bouquet,
  necklace) — only JSON definitions exist upstream; not included here yet.
- No `legs/` category (skirts/pants) — outfits currently cover the upper
  body only.
- No skin-tone variants — one body tone per gender.
- No dedicated hijab hairstyle asset.

## Note on this update
The canonical repo's master `CREDITS.csv` is ~3.8MB and could not be fetched
directly in this environment (GitHub's raw file host disallows automated
fetches here, and the file is too large to render as a GitHub blob page).
The per-file table above is unchanged from the `CREDITS.csv` shipped with
the asset sample used for this integration, cross-checked against a live
example credit export from the canonical repo's own discussion thread
(#224) for the same categories (body, hair, torso, dress) — the author
names and license families matched. For a guaranteed byte-for-byte current
copy, download `CREDITS.csv` directly from the link above, or generate a
scoped one for exactly this look by re-selecting the same body/hair/torso
or dress/feet items on https://lpc.4wall.ai/ and using its
"Credits (CSV)" download button.
