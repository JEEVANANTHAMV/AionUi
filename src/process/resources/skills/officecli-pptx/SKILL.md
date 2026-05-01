---
# officecli: v1.0.23
name: officecli-pptx
description: "Use this skill any time a .pptx file is involved -- as input, output, or both. This includes: creating slide decks, pitch decks, or presentations; reading, parsing, or extracting text from any .pptx file; editing, modifying, or updating existing presentations; combining or splitting slide files; working with templates, layouts, speaker notes, or comments. Trigger whenever the user mentions 'deck,' 'slides,' 'presentation,' or references a .pptx filename."
---

# OfficeCLI PPTX Skill

## BEFORE YOU START (CRITICAL)

> [!CAUTION]
> **zsh users (macOS default shell)**: All path parameters containing square brackets **must be quoted**, otherwise zsh will glob-expand them and throw `zsh: no matches found`.
>
> - Correct: `officecli set deck.pptx '/slide[1]'` or `"/slide[1]"`
> - Incorrect: `officecli set deck.pptx /slide[1]` (zsh will expand `[1]`)
>
> **This is an error that will almost certainly occur on first use.** Verify that quotes are working:
>
> ```bash
> officecli get deck.pptx '/slide[1]' --depth 1   # Correct (with quotes)
> ```
>
> If you see `no matches found`, it means quotes are missing.

**Note:** `officecli` is integrated as a direct tool. You can call it using the `officecli` tool in your environment. You do not need to use `run_shell_command`.

---

## 🆘 Help System (EXPLORE FIRST)

> [!TIP]
> **Don't Guess — Ask for Help**: If you are unsure about a command, property, or path, run `help` first. This is faster and more reliable than trial-and-error.

```bash
officecli --help                # Main help
officecli pptx set              # All settable elements and properties
officecli pptx add              # All addable element types
officecli pptx view             # All view modes
officecli pptx get              # All navigable paths
officecli pptx query            # Query selector syntax
```

---

## 🚀 Creating Files (MANDATORY PATTERN)

> [!CAUTION]
> **NEVER use `touch` or `python`** to create `.pptx` or `.docx` placeholders. A 0-byte file created by `touch` is NOT a valid Office document and will cause `officecli` to fail.
>
> **ALWAYS use `officecli create`**:
> ```bash
> officecli create slides.pptx
> ```

---

## Quick Reference

| Task                       | Action                              |
| -------------------------- | ----------------------------------- |
| Read / analyze content     | Use `view` and `get` commands below |
| Edit existing presentation | Read [editing.md](editing.md)       |
| Create from scratch        | Read [creating.md](creating.md)     |

---

## Execution Model

> [!IMPORTANT]
> **SERIAL EXECUTION ONLY**: Run commands one at a time. **NEVER** write commands into a shell script (`.sh`) or a JSON batch file and execute it. **NEVER** create temporary script files (`add-content.sh`, etc.). Execute each `add`, `set`, and `get` command as an individual tool call directly. This ensures the UI remains alive and errors are caught immediately.

OfficeCLI is incremental: every `add`, `set`, and `remove` immediately modifies the file and returns output. Use this to catch errors early:

1. **One command at a time, then read the output.** Check the exit code before proceeding.
2. **Non-zero exit = stop and fix immediately.** Do not continue building on a broken state.
3. **Verify after structural operations.** After adding a slide, chart, table, or animation, run `get` or `validate` before building on top of it.

Running a 50-command script all at once means the first error cascades silently through every subsequent command. Running incrementally means the failure context is immediate and local — fix it and move on.

---

## Premium Design Guidelines

> [!IMPORTANT]
> **AESTHETICS ARE MANDATORY**: Your presentation must look premium, modern, and professional. **NEVER** deliver a "shit" design with low contrast, ugly colors, or cramped layouts.

### 1. Contrast & Legibility (Non-Negotiable)
- **High Contrast Only**: Light text on Dark background OR Dark text on Light background.
- **NEVER** use Dark text on a Dark background (e.g., Black text on Dark Blue box is FORBIDDEN).
- **NEVER** use Light text on a Light background (e.g., White text on Yellow box is FORBIDDEN).
- **Font Sizes**: Titles should be 32pt+, Body text 18pt+. Code snippets 14pt+.

### 2. Premium Color Palettes
Avoid browser defaults. Use harmonious, state-of-the-art palettes:
- **Corporate Dark**: Background: `1A1A2E`, Text: `E0E0E0`, Accent: `F69F3A` (Orange) or `4ECCA3` (Teal).
- **Modern Light**: Background: `F7F9FC`, Text: `2D3436`, Accent: `0984E3` (Blue).
- **Glassmorphism**: Use semi-transparent boxes (e.g., `fill=FFFFFF;50` for 50% opacity) on gradient backgrounds.

### 3. Professional Layout Patterns
- **Rule of Thirds**: Use the `x` and `y` coordinates to place content in balanced columns.
- **Whitespace**: Leave at least 2cm margins on all sides. Do not cram text to the edges.
- **Visual Hierarchy**: Use size and weight (bold) to guide the eye. One clear headline per slide.
- **Alignment**: Align boxes precisely. If you have three boxes, ensure their `y` or `x` values match or follow a clear grid.

---

## Reading & Analyzing

### Text Extraction

```bash
officecli view slides.pptx text
officecli view slides.pptx text --start 1 --end 5
```

### Structure Overview

```bash
officecli view slides.pptx outline
```

Output shows slide titles, shape counts, and picture counts per slide.

**Note: `view outline` does not count tables and charts** — slides containing tables/charts show as "1 text box(es)", with low shape count. For a complete structure list (including table rows/columns and chart types), use:

```bash
officecli view slides.pptx annotated
```

### Detailed Inspection

```bash
officecli view slides.pptx annotated
```

Shows shape types, fonts, sizes, pictures with alt text status, tables with dimensions.

### Statistics

```bash
officecli view slides.pptx stats
```

Slide count, shape count, font usage, missing titles, missing alt text.

### Element Inspection

```bash
# List all shapes on a slide
officecli get slides.pptx /slide[1] --depth 1

# Get shape details (position, fill, font, animation, etc.)
officecli get slides.pptx /slide[1]/shape[1]

# Get chart data and config
officecli get slides.pptx /slide[1]/chart[1]

# Get table structure
officecli get slides.pptx /slide[1]/table[1] --depth 3

# Get placeholder by type
officecli get slides.pptx "/slide[1]/placeholder[title]"
```

### CSS-like Queries

```bash
# Find shapes containing specific text
officecli query slides.pptx 'shape:contains("Revenue")'

# Find pictures without alt text
officecli query slides.pptx "picture:no-alt"

# Find shapes with specific fill color
officecli query slides.pptx 'shape[fill=#4472C4]'

# Find shapes wider than 10cm
officecli query slides.pptx "shape[width>=10cm]"

# Find shapes on a specific slide
officecli query slides.pptx 'slide[2] > shape[font="Arial"]'
```

### Visual Inspection

```bash
# SVG rendering (single slide, self-contained, no dependencies)
officecli view slides.pptx svg --start 1 --end 1 --browser

# HTML rendering (all slides, interactive, with charts and 3D -- recommended)
officecli view slides.pptx html --browser
```

**Note:** SVG renders only one slide per invocation (the first in the range). Use `html --browser` for multi-slide preview with full chart/gradient/table rendering.

---

## Design Principles

**Don't create boring slides.** Plain bullets on a white background won't impress anyone.

### Before Starting

- **Pick a bold, content-informed color palette**: The palette should feel designed for THIS topic. If swapping your colors into a completely different presentation would still "work," you haven't made specific enough choices.
- **Dominance over equality**: One color should dominate (60-70% visual weight), with 1-2 supporting tones and one sharp accent. Never give all colors equal weight.
- **Dark/light contrast**: Dark backgrounds for title + conclusion slides, light for content ("sandwich" structure). Or commit to dark throughout for a premium feel.
- **Commit to a visual motif**: Pick ONE distinctive element and repeat it -- rounded image frames, icons in colored circles, thick single-side borders. Carry it across every slide.

### Color Palettes

Choose colors that match your topic -- don't default to generic blue:

| Theme                  | Primary               | Secondary             | Accent              | Text                   | Muted/Caption          |
| ---------------------- | --------------------- | --------------------- | ------------------- | ---------------------- | ---------------------- |
| **Coral Energy**       | `F96167` (coral)      | `F9E795` (gold)       | `2F3C7E` (navy)     | `333333` (charcoal)    | `8B7E6A` (warm gray)   |
| **Midnight Executive** | `1E2761` (navy)       | `CADCFC` (ice blue)   | `FFFFFF` (white)    | `333333` (charcoal)    | `8899BB` (slate)       |
| **Forest & Moss**      | `2C5F2D` (forest)     | `97BC62` (moss)       | `F5F5F5` (cream)    | `2D2D2D` (near-black)  | `6B8E6B` (faded green) |
| **Charcoal Minimal**   | `36454F` (charcoal)   | `F2F2F2` (off-white)  | `212121` (black)    | `333333` (dark gray)   | `7A8A94` (cool gray)   |
| **Warm Terracotta**    | `B85042` (terracotta) | `E7E8D1` (sand)       | `A7BEAE` (sage)     | `3D2B2B` (brown-black) | `8C7B75` (dusty brown) |
| **Berry & Cream**      | `6D2E46` (berry)      | `A26769` (dusty rose) | `ECE2D0` (cream)    | `3D2233` (dark berry)  | `8C6B7A` (mauve gray)  |
| **Ocean Gradient**     | `065A82` (deep blue)  | `1C7293` (teal)       | `21295C` (midnight) | `2B3A4E` (dark slate)  | `6B8FAA` (steel blue)  |
| **Teal Trust**         | `028090` (teal)       | `00A896` (seafoam)    | `02C39A` (mint)     | `2D3B3B` (dark teal)   | `5E8C8C` (muted teal)  |
| **Sage Calm**          | `84B59F` (sage)       | `69A297` (eucalyptus) | `50808E` (slate)    | `2D3D35` (dark green)  | `7A9488` (faded sage)  |
| **Cherry Bold**        | `990011` (cherry)     | `FCF6F5` (off-white)  | `2F3C7E` (navy)     | `333333` (charcoal)    | `8B6B6B` (dusty red)   |

Use **Text** for body copy on light backgrounds, **Muted** for captions, labels, and axis text. On dark backgrounds, use the Secondary or `FFFFFF` for body text and Muted for captions.

> **Dark background contrast rule (Hard Rule H6 supplement)**: When slide background is dark (fill brightness < 30%, such as `1E2761`, `36454F`, `000000`, etc.), all body text, card body text, chart series colors and icon fills **must** use white (`FFFFFF`) or near-white (brightness > 80%).
> **Do NOT** use neutral gray or low-saturation tones (such as `6B7B8D`, brightness ~44%) as body text color on dark backgrounds — these colors have insufficient contrast on dark backgrounds, especially noticeable in presentation settings.
> Verification method: After completing dark background slides, use `view html --browser` or visual QA subagent to confirm all text and elements are clearly visible.

**Need a color not in the table?** These palettes are starting points. You can add accent colors (e.g., gold `D4A843` with Forest & Moss) or blend palettes to match the topic. If a user requests a palette that doesn't exist by name (e.g., "Forest & Gold"), use the closest match and supplement with appropriate accent tones.

### Typography

**Choose an interesting font pairing** -- don't default to Arial.

| Header Font  | Body Font     | Best For                                    |
| ------------ | ------------- | ------------------------------------------- |
| Georgia      | Calibri       | Formal business, finance, executive reports |
| Arial Black  | Arial         | Bold marketing, product launches            |
| Calibri      | Calibri Light | Clean corporate, minimal design             |
| Cambria      | Calibri       | Traditional professional, legal, academic   |
| Trebuchet MS | Calibri       | Friendly tech, startups, SaaS               |
| Impact       | Arial         | Bold headlines, event decks, keynotes       |
| Palatino     | Garamond      | Elegant editorial, luxury, nonprofit        |
| Consolas     | Calibri       | Developer tools, technical/engineering      |

| Element        | Size                                    |
| -------------- | --------------------------------------- |
| Slide title    | 36-44pt bold                            |
| Section header | 20-24pt bold                            |
| Body text      | **16-20pt** (minimum 16pt; never below 16pt) |
| Captions       | 10-12pt muted                           |

> **Hard Rule H4**: body text minimum **16pt**, no exceptions.
> Card body text, multi-column content, bullet points must all be >= 16pt.
> "Content doesn't fit" is NOT a reason to go below 16pt — reduce text, split slides, or reduce card count instead.
> Only the following non-primary reading elements allow < 16pt: chart axis labels, legends, footnotes, KPI sublabels (descriptive text below KPI numbers).
>
> **KPI sublabel exception scope**: Only for short labels ≤5 words (such as "Active users", "MoM growth", "Q3 2025").
> If sublabel is a complete descriptive sentence (such as "Compared to last quarter's baseline figure"), this exception does NOT apply, must use >= 16pt body text or remove the text.

> **Hard Rule H7**: All content slides (not title, not closing slides) **must** include speaker notes.
> Use `officecli add deck.pptx /slide[N] --type notes --prop text="..."` to add notes to each content slide.
> Content slides missing speaker notes are a hard delivery failure.

### Layout Variety

**Every slide needs a non-text visual element** — shape, color block, chart, icon, or graphic. Text-only slides are forgettable and violate delivery standards.

#### Visual Design Checklist for No-Image Scenarios (Alternatives under CLI Limitations)

officecli can achieve rich visual effects without relying on external image files. When no image files are available, must select visual elements from at least one of the following methods:

| Method                | Implementation                                                  | Use Case                       |
| ------------------- | --------------------------------------------------------- | ------------------------------ |
| **Color block background**        | `--type shape --prop fill=COLOR --prop preset=roundRect`  | Cards, emphasis blocks                 |
| **Gradient slide background** | `--prop "background=COLOR1-COLOR2-180"`                   | Section dividers, title slides |
| **Icon in circle**  | Colored ellipse + centered text/number overlay (see creating.md)        | Feature lists, process steps             |
| **Large font stat numbers**  | `--prop size=64 --prop bold=true` (60-72pt numbers) + small labels | KPI, stats slides              |
| **Charts**            | `--type chart` (column/pie/line, etc.)                      | Data display slides                |
| **Shape combinations**        | circles + connectors + arrows to build diagrams/process flows               | Architecture diagrams, timelines                 |

**Mandatory checkpoint**: Every 3 content slides, at least 1 must contain one of the above non-text visual elements (color blocks/shapes/charts). Text-only slides are only allowed in the following cases: quotes, code examples, pure table slides.

Vary across these layout types:

- Two-column (text left, visual right)
- Icon + text rows (icon in colored circle, bold header, description)
- 2x2 or 2x3 grid (content blocks)
- Half-bleed image (full left/right side) with content overlay
- Large stat callouts (big numbers 60-72pt with small labels below)
- Comparison columns (before/after, pros/cons)
- Timeline or process flow (numbered steps, arrows)

### Content-to-Layout Quick Guide

These are starting points. Adapt based on content density and narrative flow.

| Content Type          | Recommended Layout                         | Why                                          |
| --------------------- | ------------------------------------------ | -------------------------------------------- |
| Pricing / plan tiers  | 2-3 column cards (comparison)              | Side-by-side enables instant comparison      |
| Team / people         | Icon grid or 2x3 cards                     | Faces/avatars need equal visual weight       |
| Timeline / roadmap    | Process flow with arrows or numbered steps | Left-to-right communicates sequence          |
| Key metrics / KPIs    | Large stat callouts (3-4 big numbers)      | Big numbers grab attention; labels below     |
| Testimonials / quotes | Full-width quote with attribution          | Generous whitespace signals credibility      |
| Feature comparison    | Two-column before/after or table           | Parallel structure aids scanning             |
| Architecture / system | Shapes + connectors diagram                | Spatial relationships need visual expression |
| Financial data        | Chart + summary table side-by-side         | Chart shows trend; table provides precision  |

### Spacing

- 0.5" (1.27cm) minimum margins from slide edges
- 0.3-0.5" (0.76-1.27cm) between content blocks
- Leave breathing room -- don't fill every inch

### Avoid (Common Mistakes)

- **Don't repeat the same layout** -- vary columns, cards, and callouts across slides
- **Don't center body text** -- left-align paragraphs and lists; center only titles
- **Don't skimp on size contrast** -- titles need 36pt+ to stand out from 14-16pt body
- **Don't default to blue** -- pick colors that reflect the specific topic
- **Don't mix spacing randomly** -- choose 0.3" or 0.5" gaps and use consistently
- **Don't style one slide and leave the rest plain** -- commit fully or keep it simple throughout
- **Don't create text-only slides** -- add images, icons, charts, or visual elements
- **Don't forget text box padding** -- when aligning shapes with text edges, set `margin=0` on the text box or offset to account for default padding
- **Don't use low-contrast elements** -- icons AND text need strong contrast against the background
- **NEVER use accent lines under titles** -- these are a hallmark of AI-generated slides; use whitespace or background color instead
- **COLOR CONTRAST RULE**: If a shape has a dark fill (e.g., `1E2761`, `2C5F2D`), the text inside it **MUST** be white (`FFFFFF`) or a very light accent color. Default black text on dark shapes is a critical failure.
- **AVOID VIBRANT BLUE**: The default blue (`0000FF`) is "shit colors". Use `1E2761` (Midnight Blue) or `CADCFC` (Soft Blue) instead.

### 🚫 The "Shit Colors" Wall of Shame (DO NOT DO)
- **Black text on Dark Blue box**: Unreadable. Use white text.
- **Pure Black backgrounds** (`000000`): Too harsh. Use `1E1E1E` (Off-black) or `1E2761` (Navy).
- **Vibrant Magenta / Cyan / Pure Green**: Too "gamer" or "unprofessional". Use muted/sophisticated variants.
- **Default Chart Colors**: Always override with your chosen palette.

---

## QA (Required)

**Assume there are problems. Your job is to find them.**

Your first render is almost never correct. Approach QA as a bug hunt, not a confirmation step. If you found zero issues on first inspection, you weren't looking hard enough.

### Content QA

```bash
# Extract all text, check for missing content, typos, wrong order
officecli view slides.pptx text
```

> **Note: `view text` does NOT extract text within tables.** To verify table content, use
> `officecli get deck.pptx '/slide[N]/table[M]' --json` to check cell content.
> For slides that heavily use tables such as QBRs and technical specifications, relying only on `view text` will create QA blind spots.

```bash

# Check for structural and formatting issues automatically
officecli view slides.pptx issues
```

**Note:** `view issues` reports "Slide has no title" for all blank-layout slides. This is expected when using `layout=blank` (the recommended approach for custom designs). These warnings can be safely ignored.

When editing templates, check for leftover placeholder text:

```bash
officecli query slides.pptx 'shape:contains("lorem")'
officecli query slides.pptx 'shape:contains("xxxx")'
officecli query slides.pptx 'shape:contains("placeholder")'
```

### Visual QA

**Use subagents** -- even for 2-3 slides. You've been staring at the code and will see what you expect, not what's there. Subagents have fresh eyes.

```bash
# Render a single slide as SVG for visual inspection
officecli view slides.pptx svg --start 3 --end 3 --browser

# Loop through slides for multi-slide QA
for i in 1 2 3 4 5; do officecli view slides.pptx svg --start $i --end $i > /tmp/slide-$i.svg; done
```

**SVG limitations:** SVG renders only one slide (the first in the `--start`/`--end` range). Gradient backgrounds, charts, and tables are not visible in SVG output. For full-fidelity multi-slide preview including charts and gradients, use HTML mode:

```bash
officecli view slides.pptx html --browser
```

Prompt for visual QA subagent:

```
Visually inspect these slides. Assume there are issues -- find them.

Look for:
- Overlapping elements (text through shapes, lines through words, stacked elements)
- Text overflow or cut off at edges/box boundaries
- Elements too close (< 0.3" gaps) or cards/sections nearly touching
- Uneven gaps (large empty area in one place, cramped in another)
- Insufficient margin from slide edges (< 0.5")
- Columns or similar elements not aligned consistently
- Low-contrast text (e.g., light gray on cream background)
- Low-contrast icons (e.g., dark icons on dark backgrounds without a contrasting circle)
- Text boxes too narrow causing excessive wrapping
- Leftover placeholder content

For each slide, list issues or areas of concern, even if minor.
Report ALL issues found.
```

**Editing-specific QA checklist (in addition to the above):**

- [ ] On every template slide (not new blank slides), verify that NO decorative element (`!!`-prefixed shape) overlaps or obscures content text
- [ ] Verify all hero numbers / key metrics are visible (not hidden by card fills or same-color-as-background)
- [ ] On dark background slides, verify chart bars/lines, axis labels, and gridlines are visible

### Validation

```bash
# Schema validation -- must pass before delivery
officecli validate slides.pptx
```

### Pre-Delivery Checklist

Before declaring a presentation complete, verify:

- [ ] **（Hard Rule H7）Speaker notes verification**: Use `officecli view deck.pptx annotated` to confirm each content slide (not title, not closing) has a speaker notes entry. Content slides missing notes are a hard delivery failure.
- [ ] At least one transition style applied (fade for title, push or wipe for content)
- [ ] Alt text on all pictures
- [ ] At least 3 different layout types used across slides
- [ ] No two consecutive slides share the same layout pattern
- [ ] `view issues` "Slide has no title" warnings — **expected and safe to ignore** when using `layout=blank`. All custom designs use blank layout; these warnings are not real issues.
- [ ] **Overflow check (mandatory for each slide)**: For all text boxes and shapes on each slide, confirm `y + height ≤ 19.05cm` (standard widescreen height) and `x + width ≤ 33.87cm` (standard width). If overflow exists, reduce font size or shorten text, **do not rely on clipping**.
- [ ] **Card layout cell-by-cell overflow check**: For multi-card layouts (step cards, feature grids, timeline flows), verify `y + height ≤ 19.05cm` for each card. Use `officecli get deck.pptx '/slide[N]/shape[M]'` to check each card one by one — do not estimate based on card count, must measure cell by cell.
- [ ] **Agenda consistency**: If there is an Agenda/TOC slide, confirm all sections listed match actual slide titles and order exactly, no sections omitted.
- [ ] **Font size compliance (Hard Rule H4)**: All body text, card body text, bullet points, multi-column content font size >= 16pt. Exceptions allowing < 16pt are limited to: chart axis labels, legends, KPI sublabels (short labels ≤5 words), footnotes.

> **Hard Rule H4 clarification**: body text >= 16pt has no exceptions. If content doesn't fit,
> the solution is to reduce text or split slides, not reduce font size.
> Exceptions allowing < 16pt: chart axis labels, legends, KPI sublabels (**short labels only ≤5 words**, such as "Active users", "MoM growth"; complete descriptive sentences do NOT qualify for this exception), footnotes.

- [ ] **Chart titles have no empty placeholders**: All chart titles must not contain empty placeholders such as `()`, `[]`, `TBD`, `XXX`.
      If titles contain dynamic content (such as unit `$M`), must replace with actual values during QA phase.
      Check command: `officecli view slides.pptx text` then search for `"()"`.

### Verification Loop

1. Generate slides
2. Run `view issues` + `validate` + visual inspection
3. **List issues found** (if none found, look again more critically)
4. Fix issues
5. **Re-verify affected slides** -- one fix often creates another problem
6. Repeat until a full pass reveals no new issues

**Do not declare success until you've completed at least one fix-and-verify cycle.**

> [!IMPORTANT]
> **Tool Call Pattern**: When calling `officecli` as a tool, pass the subcommand as the `command` argument (e.g. `command: "view slides.pptx text"`).

---

## Common Pitfalls

| Pitfall                                  | Correct Approach                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ⚠️ Unquoted `[N]` in zsh/bash            | Shell glob-expands `/slide[1]` and throws `no matches found`. **Always quote paths**: `"/slide[1]"` or `'/slide[1]'`. This is the #1 first-use stumbling block on zsh.                                                                                                                                                                                                                            |
| `--name "foo"`                           | Use `--prop name="foo"` -- all attributes go through `--prop`                                                                                                                                                                                                                                                                                                                                     |
| `x=-3cm`                                 | Negative coordinates **are supported** and can be used for bleed effects (e.g., `x=-2cm` lets a decorative element overflow the left edge).                                                                                                                                                                                                                                                       |
| `/shape[myname]`                         | Name indexing not supported. Use numeric index: `/shape[3]`                                                                                                                                                                                                                                                                                                                                       |
| Guessing property names                  | Run `officecli pptx set shape` to see exact names                                                                                                                                                                                                                                                                                                                                                 |
| `\n`/`\\` in shell strings & code slides | Plain text shape: use `\\n` for newlines, such as `--prop text="line1\\nline2"`.<br>**Code slides special note**: `--prop text="kubectl apply \\n  -f pod.yaml"` will display literal `\\n` on slide (not newline). For demo code content, use single `\n` for actual newlines: `--prop text="line1\nline2"`. But in shell single-quoted strings, `\n` is literal. |
| Modifying an open file                   | Close the file in PowerPoint/WPS first                                                                                                                                                                                                                                                                                                                                                            |
| Hex colors with `#`                      | Use `FF0000` not `#FF0000` -- no hash prefix                                                                                                                                                                                                                                                                                                                                                      |
| Theme colors                             | Use `accent1`..`accent6`, `dk1`, `dk2`, `lt1`, `lt2` -- not hex                                                                                                                                                                                                                                                                                                                                   |
| Forgetting alt text                      | Always set `--prop alt="description"` on pictures for accessibility                                                                                                                                                                                                                                                                                                                               |
| Paths are 1-based                        | `/slide[1]`, `/shape[1]` -- XPath convention                                                                                                                                                                                                                                                                                                                                                      |
| `--index` is 0-based                     | `--index 0` = first position -- array convention                                                                                                                                                                                                                                                                                                                                                  |
| Z-order (shapes overlapping)             | Use `--prop zorder=back` or `zorder=front` / `forward` / `backward` / absolute position number. **WARNING:** Z-order changes cause shape index renumbering -- re-query with `get --depth 1` after any z-order change before referencing shapes by index. Process highest index first when changing multiple shapes.                                                                               |
| `gap`/`gapwidth` on chart add            | Ignored during `add` -- set it after creation: `officecli set ... /slide[N]/chart[M] --prop gap=80`                                                                                                                                                                                                                                                                                               |
| `$` in `--prop text=` (shell)            | `--prop text="$15M"` strips the value — shell expands `$15` as a variable. Use single quotes: `--prop text='$15M'`.                                                                                                                                                                                                                             |
| Template text at wrong size              | Template shapes have baked-in font sizes. Always include `size`, `font`, and `color` in every `set` on template shapes. See editing.md "Font Cascade from Template Shapes" section.                                                                                                                                                                                                               |

---

## Recipes (Common Scenario Fix Guide)

The following recipes target visual problems that frequently occur during actual production. Each is a directly executable fix solution.

### Recipe 1: Section Divider — Label Text Overlaps with Decorative Elements

**Root cause:** Later-added shapes are on top in z-order; if decorative shapes (circles, rectangles) are added after text shapes, they will cover the text, making titles unreadable.

**Fix rules:**

1. **Addition order = z-order**: Decorative elements (circles, color blocks) must be added first, text shapes added last — later additions automatically go to the top layer.
2. **Title text y position recommended 7-10cm** (slide height 19.05cm), avoid overlapping with top or bottom decorative elements.
3. If z-order adjustment is needed for existing shapes, use `--prop zorder=back` (decorative elements) or `--prop zorder=front` (text).
**Fix rules (SERIAL EXECUTION):**
1. **Decorative elements first**: Always add backgrounds, graphic numbers, and bars before adding content/text.
2. **Text last**: Add titles, body text, and labels only after all structural/decorative elements are placed.
3. **Z-order adjustment**: If reordering is required, verify indices after every move.

```bash
# Correct order example (decorative first, text last)
officecli add slides.pptx / --type slide --prop layout=blank --prop "background=1E2761-CADCFC-180"

# Step 1: Decorative elements (large semi-transparent number as background graphic) — add first, on bottom layer
officecli add slides.pptx /slide[N] --type shape --prop text="02" \
  --prop x=2cm --prop y=4cm --prop width=29.87cm --prop height=8cm \
  --prop font=Georgia --prop size=120 --prop bold=true \
  --prop color=FFFFFF --prop align=center --prop fill=none --prop opacity=0.15

# Step 2: Left decorative color bar (optional) — decorative element, on bottom layer
officecli add slides.pptx /slide[N] --type shape \
  --prop preset=rect --prop fill=FFFFFF --prop opacity=0.2 \
  --prop x=0cm --prop y=7cm --prop width=6cm --prop height=0.4cm --prop line=none

# Step 3: Title text — add last, automatically on top layer, y recommended 7-10cm
officecli add slides.pptx /slide[N] --type shape --prop text="Financial Performance" \
  --prop x=2cm --prop y=7.5cm --prop width=29.87cm --prop height=3cm \
  --prop font=Georgia --prop size=40 --prop bold=true \
  --prop color=FFFFFF --prop align=center --prop fill=none

# Step 4: Subtitle (optional)
officecli add slides.pptx /slide[N] --type shape --prop text="Section 2 of 4" \
  --prop x=2cm --prop y=11cm --prop width=29.87cm --prop height=1.5cm \
  --prop font=Calibri --prop size=16 --prop color=CADCFC --prop align=center --prop fill=none
```

**Post-check (if coverage issues occur):**

```bash
# Push decorative elements to bottom layer
officecli set slides.pptx "/slide[N]/shape[1]" --prop zorder=back
# Pull text to top layer
officecli set slides.pptx "/slide[N]/shape[3]" --prop zorder=front
# Note: After zorder operations, shape indices will be renumbered, must re-run get --depth 1 before operating
officecli get slides.pptx '/slide[N]' --depth 1
```

**事后检查（如遇覆盖问题）：**

```bash
# 将装饰元素压到最底层
officecli set slides.pptx "/slide[N]/shape[1]" --prop zorder=back
# 将文字拉到最顶层
officecli set slides.pptx "/slide[N]/shape[3]" --prop zorder=front
# 注意：zorder 操作后 shape index 会重新编号，须重新 get --depth 1 再操作
officecli get slides.pptx '/slide[N]' --depth 1
```

---

### Recipe 2: KPI Box — Numbers/Text Overflow Box Boundaries

**Root cause:** KPI number font size is too large, exceeds box height or width range; or box dimensions do not leave enough space for number font size.

**Font size safety formula:**

- `Recommended max font size (pt) ≤ box_width_cm × character denominator`
  - 1-2 characters (such as "94%"): `box_width_cm × 10` pt as upper limit, recommend 60-72pt
  - 3-4 characters (such as "1.2M"): `box_width_cm × 7` pt as upper limit, recommend 48-56pt
  - 5+ characters: `box_width_cm × 5` pt as upper limit, recommend 36-44pt
- `box height ≥ font_size(cm) × 1.5` (1pt ≈ 0.0353cm; 64pt ≈ 2.26cm, then height ≥ 3.4cm)

**Verification rule (mandatory):** After each KPI box is created, use `officecli view annotated` to confirm no overflow.

```bash
# KPI box safety template (for 9cm wide box, 3-character number example)
# 9cm wide × 3 characters → max font size ~9×7=63pt → use 60pt
# box height ≥ 60pt × 0.0353cm × 1.5 ≈ 3.2cm → set to 4cm (leave margin)

officecli add slides.pptx /slide[N] --type shape \
  --prop text="94%" \
  --prop x=2cm --prop y=5cm \
  --prop width=9cm --prop height=4cm \
  --prop font=Georgia --prop size=60 --prop bold=true \
  --prop color=CADCFC --prop align=center --prop valign=center --prop fill=none

# sublabel (KPI description label, ≤5 words, allows < 16pt)
officecli add slides.pptx /slide[N] --type shape \
  --prop text="Customer Retention" \
  --prop x=2cm --prop y=9.2cm \
  --prop width=9cm --prop height=1.5cm \
  --prop font=Calibri --prop size=13 --prop color=8899BB --prop align=center --prop fill=none
```

**Overflow fix process:**

1. Overflow detected → first reduce font size (reduce 4pt at a time, re-check)
2. Font size already small enough but still overflows → increase box `height` (adjust y value upward accordingly)
3. Do NOT shorten the number itself ("$1.2M" cannot be changed to "$1M" just for font size compliance)

```bash
# Verification command
officecli view slides.pptx annotated
# Check each KPI shape's y+height is ≤ 19.05cm
officecli get slides.pptx '/slide[N]/shape[M]'
```

**溢出修复流程：**

1. 发现溢出 → 先缩小字号（每次减 4pt，重新检查）
2. 字号已足够小但仍溢出 → 扩大 box `height`（y 值相应上移）
3. 不得缩短数字本身（"$1.2M" 不能改成 "$1M" 只为字号合规）

```bash
# 验证命令
officecli view slides.pptx annotated
# 检查每个 KPI shape 的 y+height 是否 ≤ 19.05cm
officecli get slides.pptx '/slide[N]/shape[M]'
```

---

### Recipe 3: Timeline — Last Node Isolated (Uneven Spacing)

**Root cause:** When directly setting the last node x to `slide_width - right_margin`, floating-point precision differences cause its spacing from adjacent nodes to be larger, visually appearing "isolated".

**Even spacing formula:**

```
left_margin   = 2cm (or as designed)
right_margin  = 2cm (or as designed)
circle_width  = width of node circle (e.g., 3cm)

# CRITICAL: usable_width must subtract circle_width, otherwise last node right edge will overflow slide
usable_width = slide_width - left_margin - right_margin - circle_width
             = 33.87 - 2 - 2 - 3 = 26.87cm (standard 16:9, circle_width=3cm)

node_spacing = usable_width / (N - 1)   # N = total number of nodes

node_x[i]   = left_margin + node_spacing × i   # i = 0, 1, ..., N-1
```

> **Why subtract circle_width?** `node_x[i]` is the circle's **left x**, last node right edge = `node_x[N-1] + circle_width`. Without subtracting, right edge will exceed slide edge (33.87cm), causing P1 truncation error.

**Example (4 nodes, circle width 3cm):**

```
usable_width = 33.87 - 2 - 2 - 3 = 26.87cm
node_spacing = 26.87 / 3 ≈ 8.957cm

node_x[0] = 2cm              → circle x=2cm,     right edge 5cm    ✓
node_x[1] = 2 + 8.957      = 10.957cm → circle x=10.96cm,   right edge 13.96cm  ✓
node_x[2] = 2 + 8.957×2    = 19.914cm → circle x=19.91cm,   right edge 22.91cm  ✓
node_x[3] = 2 + 8.957×3    = 28.87cm  → circle x=28.87cm,   right edge 31.87cm  ✓ (< 33.87)
```

```bash
# 4-node even timeline example (node_spacing ≈ 8.957cm, circle width 3cm, usable_width=26.87cm)
# Horizontal baseline (from first node center to last node center)
officecli add slides.pptx /slide[N] --type connector \
  --prop x=3.5cm --prop y=10cm --prop width=27.87cm --prop height=0 \
  --prop line=CADCFC --prop lineWidth=2pt

# Node 1 (i=0)  x = 2cm, right edge 5cm ✓
officecli add slides.pptx /slide[N] --type shape \
  --prop preset=ellipse --prop fill=1E2761 \
  --prop x=2cm --prop y=8.5cm --prop width=3cm --prop height=3cm --prop line=none
officecli add slides.pptx /slide[N] --type shape --prop text="Q1" \
  --prop x=2cm --prop y=8.5cm --prop width=3cm --prop height=3cm \
  --prop fill=none --prop color=FFFFFF --prop size=16 --prop bold=true \
  --prop align=center --prop valign=center

# Node 2 (i=1)  x = 2 + 8.957 = 10.957cm → use 10.96cm, right edge 13.96cm ✓
officecli add slides.pptx /slide[N] --type shape \
  --prop preset=ellipse --prop fill=CADCFC \
  --prop x=10.96cm --prop y=8.5cm --prop width=3cm --prop height=3cm --prop line=none
officecli add slides.pptx /slide[N] --type shape --prop text="Q2" \
  --prop x=10.96cm --prop y=8.5cm --prop width=3cm --prop height=3cm \
  --prop fill=none --prop color=1E2761 --prop size=16 --prop bold=true \
  --prop align=center --prop valign=center

# Node 3 (i=2)  x = 2 + 8.957×2 = 19.914cm → use 19.91cm, right edge 22.91cm ✓
officecli add slides.pptx /slide[N] --type shape \
  --prop preset=ellipse --prop fill=1E2761 \
  --prop x=19.91cm --prop y=8.5cm --prop width=3cm --prop height=3cm --prop line=none
officecli add slides.pptx /slide[N] --type shape --prop text="Q3" \
  --prop x=19.91cm --prop y=8.5cm --prop width=3cm --prop height=3cm \
  --prop fill=none --prop color=FFFFFF --prop size=16 --prop bold=true \
  --prop align=center --prop valign=center

# Node 4 (i=3)  x = 2 + 8.957×3 = 28.871cm → use 28.87cm, right edge 31.87cm ✓ (< 33.87)
officecli add slides.pptx /slide[N] --type shape \
  --prop preset=ellipse --prop fill=CADCFC \
  --prop x=28.87cm --prop y=8.5cm --prop width=3cm --prop height=3cm --prop line=none
officecli add slides.pptx /slide[N] --type shape --prop text="Q4" \
  --prop x=28.87cm --prop y=8.5cm --prop width=3cm --prop height=3cm \
  --prop fill=none --prop color=1E2761 --prop size=16 --prop bold=true \
  --prop align=center --prop valign=center
```

**Verification command:** After creating timeline, check node x coordinates are evenly distributed:

```bash
officecli view slides.pptx annotated
# Or check node by node
officecli get slides.pptx '/slide[N]' --depth 1
# Manually verify adjacent node x differences are consistent (allow ±0.05cm error)
```

If last node appears isolated: calculate actual spacing (`x[N-1] - x[N-2]` vs `x[1] - x[0]`), use even spacing formula to reset last node x coordinate:

```bash
officecli set slides.pptx "/slide[N]/shape[M]" --prop x=31.87cm
```
left_margin   = 2cm（或按设计）
right_margin  = 2cm（或按设计）
circle_width  = 节点圆的宽度（例如 3cm）

# CRITICAL: usable_width 必须减去 circle_width，否则最后节点右边界会溢出幻灯片
usable_width = slide_width - left_margin - right_margin - circle_width
             = 33.87 - 2 - 2 - 3 = 26.87cm（标准 16:9，circle_width=3cm）

node_spacing = usable_width / (N - 1)   # N = 节点总数

node_x[i]   = left_margin + node_spacing × i   # i = 0, 1, ..., N-1
```

> **为什么减 circle_width？** `node_x[i]` 是圆的**左边 x**，最后节点右边界 = `node_x[N-1] + circle_width`。不减的话右边界会超出幻灯片边缘（33.87cm），导致 P1 截断错误。

**示例（4 节点，节圆宽 3cm）：**

```
usable_width = 33.87 - 2 - 2 - 3 = 26.87cm
node_spacing = 26.87 / 3 ≈ 8.957cm

node_x[0] = 2cm              → circle x=2cm,     右边 5cm    ✓
node_x[1] = 2 + 8.957      = 10.957cm → circle x=10.96cm,   右边 13.96cm  ✓
node_x[2] = 2 + 8.957×2    = 19.914cm → circle x=19.91cm,   右边 22.91cm  ✓
node_x[3] = 2 + 8.957×3    = 28.87cm  → circle x=28.87cm,   右边 31.87cm  ✓ (< 33.87)
```

```bash
# 4 节点均匀时间轴示例（node_spacing ≈ 8.957cm，圆宽 3cm，usable_width=26.87cm）
# 水平基准线（从第一节点圆心到最后节点圆心）
officecli add slides.pptx /slide[N] --type connector \
  --prop x=3.5cm --prop y=10cm --prop width=27.87cm --prop height=0 \
  --prop line=CADCFC --prop lineWidth=2pt

# 节点 1（i=0）  x = 2cm，右边 5cm ✓
officecli add slides.pptx /slide[N] --type shape \
  --prop preset=ellipse --prop fill=1E2761 \
  --prop x=2cm --prop y=8.5cm --prop width=3cm --prop height=3cm --prop line=none
officecli add slides.pptx /slide[N] --type shape --prop text="Q1" \
  --prop x=2cm --prop y=8.5cm --prop width=3cm --prop height=3cm \
  --prop fill=none --prop color=FFFFFF --prop size=16 --prop bold=true \
  --prop align=center --prop valign=center

# 节点 2（i=1）  x = 2 + 8.957 = 10.957cm → 取 10.96cm，右边 13.96cm ✓
officecli add slides.pptx /slide[N] --type shape \
  --prop preset=ellipse --prop fill=CADCFC \
  --prop x=10.96cm --prop y=8.5cm --prop width=3cm --prop height=3cm --prop line=none
officecli add slides.pptx /slide[N] --type shape --prop text="Q2" \
  --prop x=10.96cm --prop y=8.5cm --prop width=3cm --prop height=3cm \
  --prop fill=none --prop color=1E2761 --prop size=16 --prop bold=true \
  --prop align=center --prop valign=center

# 节点 3（i=2）  x = 2 + 8.957×2 = 19.914cm → 取 19.91cm，右边 22.91cm ✓
officecli add slides.pptx /slide[N] --type shape \
  --prop preset=ellipse --prop fill=1E2761 \
  --prop x=19.91cm --prop y=8.5cm --prop width=3cm --prop height=3cm --prop line=none
officecli add slides.pptx /slide[N] --type shape --prop text="Q3" \
  --prop x=19.91cm --prop y=8.5cm --prop width=3cm --prop height=3cm \
  --prop fill=none --prop color=FFFFFF --prop size=16 --prop bold=true \
  --prop align=center --prop valign=center

# 节点 4（i=3）  x = 2 + 8.957×3 = 28.871cm → 取 28.87cm，右边 31.87cm ✓ (< 33.87)
officecli add slides.pptx /slide[N] --type shape \
  --prop preset=ellipse --prop fill=CADCFC \
  --prop x=28.87cm --prop y=8.5cm --prop width=3cm --prop height=3cm --prop line=none
officecli add slides.pptx /slide[N] --type shape --prop text="Q4" \
  --prop x=28.87cm --prop y=8.5cm --prop width=3cm --prop height=3cm \
  --prop fill=none --prop color=1E2761 --prop size=16 --prop bold=true \
  --prop align=center --prop valign=center
```

**验证命令：** 创建时间轴后，检查各节点 x 坐标是否均匀分布：

```bash
officecli view slides.pptx annotated
# 或逐节点检查
officecli get slides.pptx '/slide[N]' --depth 1
# 手动验证相邻节点的 x 差值是否一致（允许 ±0.05cm 误差）
```

如发现最后节点孤立：计算实际间距（`x[N-1] - x[N-2]` vs `x[1] - x[0]`），用均匀间距公式重新设置最后节点的 x 坐标：

```bash
officecli set slides.pptx "/slide[N]/shape[M]" --prop x=31.87cm
```

---

## Performance: Resident Mode

**Always use `open`/`close` — it is the smart default, not a special-case optimization.** Every command benefits: no repeated file I/O, no repeated parse/serialize cycles.

```bash
officecli open slides.pptx        # Load once into memory
officecli add slides.pptx ...     # All commands run in memory — fast
officecli set slides.pptx ...
officecli close slides.pptx       # Write once to disk
```

Use this pattern for every presentation build, regardless of command count.

---

## Known Issues

| Issue                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Workaround                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Chart series cannot be added after creation**: `set --prop data=` and `set --prop seriesN=` on an existing chart can only update existing series -- they cannot add new series. The series count is fixed at creation time.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Include all series in the `add` command (using `series1`+`series2` props or the `data` prop). Both forms work reliably in single commands. If you need to add series to an existing chart, delete it and recreate: `officecli remove file.pptx "/slide[N]/chart[M]"` then `officecli add` with all series. See creating.md "Multi-Series Column Chart" and editing.md "Update Charts". |
| **Table cell solidFill schema warning**: Setting `color` on table cell run properties may produce `solidFill` schema validation errors. The table renders correctly in PowerPoint.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Ignore if the table opens correctly. Alternatively, set text color at the row level (`set tr[N] --prop color=HEX`) instead of the cell level.                                                                                                                                                                                                                                                            |
| **Multi-series chart rendering in SVG/screenshot**: SVG and screenshot renders may show fewer series than actually exist in the chart data. The chart data is correct but the rendering engine does not always display all series visually.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Verify multi-series charts by opening the .pptx in PowerPoint or by using `get /slide[N]/chart[M]` to confirm all series are present in the data. Do not rely solely on SVG/screenshot visual QA for multi-series verification.                                                                                                                                                                          |
| **Slide titles show as "(untitled)" in `view outline` / `view issues`**: When using `layout=blank` (the recommended approach for custom designs), all titles are added as plain text boxes — not as PPTX title placeholder elements. As a result, `view outline` and `view issues` report "(untitled)" for every slide, and screen reader outline navigation will not find slide titles. This is **expected behavior** for blank-layout decks. Evaluators and testers should not flag this as a defect when the deck uses `layout=blank`. If outline-compatible titles are required, use `officecli set deck.pptx "/slide[N]/placeholder[title]" --prop text="Title"` to set the PPTX title placeholder — but note this requires a layout that includes a title placeholder (i.e., not `layout=blank`). |

