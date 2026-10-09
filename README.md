# Measles Outbreak Simulator

A static, embeddable rebuild of the measles dashboard in
[epiworldRShiny](https://github.com/UofUEpiBio/epiworldRShiny). The Shiny app
needs an R server to run its simulations. This version runs them in the
browser with [epiworldjs](https://github.com/UofUEpiBio/epiworldjs), the
WebAssembly build of epiworld and the
[measles](https://github.com/UofUEpiBio/measles) models, so it can be hosted
on any static web server (GitHub Pages, S3, a health department's CMS).

It has two simulators, each comparing outbreaks **with and without
quarantine**:

- **School** (`MeaslesSchool`): one school. Keeps the Shiny app's inputs,
  outputs and the state → county → school selector, which fills in the
  vaccination coverage from the bundled data for about 49,000 schools in 25
  states (or from an uploaded CSV).
- **Community** (`MeaslesMixing`): a larger population of groups (age groups,
  schools, neighborhoods, …) with a contact matrix between them. It adds
  contact tracing, and the groups come from presets in
  `public/data/populations/`.

Both are parameterized by **R0** rather than a raw contact rate (see
[R0 calibration](#r0-calibration)).

Results update as you change inputs, after a 350 ms pause. Runs that are
large (agents × simulations × days above 5×10⁷) first show a preview from 40
simulations, then refine to the full run. The preview's simulations are the
same as the first 40 of the full run, since each simulation has its own
seed. A new change made during a run is queued, not piled up. With the
`manual` attribute, a Run button starts runs instead.

## Versioning and releases

The project follows [semantic versioning](https://semver.org/), starting at
0.1.0. The version lives in `package.json`, and the site shows it in the
header and footer, linked to the
[latest release](https://github.com/EpiForeSITE/measles-dashboard/releases/latest).
Changes are listed in [CHANGELOG.md](CHANGELOG.md).

[please-bump](https://github.com/gvegayon/please-bump) checks every PR
(`.github/please-bump.yaml`).

- Once a version is released, the next PR that changes the dashboard
  (`src/`, `public/`, pages, build) must bump it: patch for fixes, minor for
  features, major for breaking changes to the embedding API.
- PRs that only change tests, docs or CI don't need a bump.
- A `no-version-bump` label waives the check.

To release, publish a GitHub release tagged `vX.Y.Z` matching `package.json`.

## Quick start

```sh
npm install
npm run dev          # http://localhost:5173
npm run build        # dist/: the static site and the embeddable bundle
npm run preview      # serve dist/ at http://localhost:4173
```

## Embedding

`dist/` is self-contained:

- `measles-dashboard.js`: the bundle
- `epiworldjs/`: the engine and its `.wasm`
- `data/`
- `assets/`

Copy it anywhere and add the script and an element:

```html
<script type="module" src="/measles/measles-dashboard.js"></script>

<!-- Both simulators as tabs -->
<measles-dashboard default-state="UT"></measles-dashboard>

<!-- Or a single simulator -->
<measles-school-sim default-state="UT" hide-description></measles-school-sim>
<measles-mixing-sim preset="default-3group"></measles-mixing-sim>
```

`embed.html` is a working example, styled as an imaginary health department.

### Attributes

| Attribute | Elements | Meaning |
|---|---|---|
| `tabs` | dashboard | Tabs and their order, e.g. `"mixing,school"` or `"school"` (default `"school,mixing"`). |
| `default-state` | dashboard, school | Two-letter state preselected in the school selector. |
| `preset` | dashboard, mixing | Id of the population preset (from `data/populations/index.json`). |
| `nsims` | school, mixing | Default number of simulations. |
| `manual` | school, mixing | Show a Run button instead of updating results automatically. |
| `base-url` | all | Folder holding `data/` and `assets/` (default: next to the script). |
| `engine-url` | all | URL of epiworldjs's `src/index.js`, e.g. `https://cdn.jsdelivr.net/npm/epiworldjs@0.18.0-0/src/index.js`. |
| `hide-description`, `hide-acknowledgements` | all | Hide those cards. |
| `hide-footer` | dashboard | Hide the version footer. |

`configure({ baseUrl, engineUrl })` (exported by the bundle) does the same for
the whole page.

### Styling

Everything renders in shadow DOM, so host-page CSS does not leak in. To
restyle the dashboard, set these custom properties on the element or any
ancestor:

| Property | Default |
|---|---|
| `--md-primary` / `--md-on-primary` | `#2f5fd0` / `#fff` |
| `--md-font-family`, `--md-font-size` | system UI, `15px` |
| `--md-color-no-quarantine`, `--md-color-quarantine` | `#c11a01`, `#307bc2` (tiles and charts) |
| `--md-color-good` | `#1b7f4a` (the "quarantine prevents" tile) |
| `--md-background`, `--md-surface`, `--md-surface-alt` | `#f6f7f9`, white, `#f1f3f6` |
| `--md-text`, `--md-text-muted`, `--md-border` | `#1d2433`, `#5f6b7a`, `#e3e6eb` |
| `--md-radius`, `--md-shadow`, `--md-sidebar-width` | `12px`, subtle, `320px` |
| `--md-warning-bg`, `--md-warning-text`, `--md-warning-border`, `--md-error` | Bootstrap-like |
| `--md-tooltip-bg`, `--md-tooltip-text` | dark |

For finer control, use these parts with `::part()`:

- `sidebar`, `run-button` (manual mode), `accordion`, `intro`, `about`, `card`, `description`, `assumptions`, `acknowledgements`, `population`, `school-chip`
- Results: `tile`, `tile-without`, `tile-with`, `tile-impact`, `download-button`
- On the dashboard: `tabs`, `tab`, `footer`

For example: `measles-school-sim::part(run-button) { text-transform: uppercase; }`.

### Events

All events bubble and are composed, so you can listen on the element or on
`document`. They replace the Shiny app's Google Analytics hook: forward them
to your own analytics.

| Event | `detail` |
|---|---|
| `md-run-start` | `{specs, preview}`: the epiworldjs specs about to run |
| `md-run-complete` | `{results: {with, without}: {meanCases, meanHospitalizations}, specs, ms, preview}`. `preview` is true for the quick first pass of a large run. |
| `md-run-error` | `{error}` |
| `md-school-selected` | `{school: {state, county, name, id, rate, size}}` |
| `md-school-cleared` | none |

Calling `element.run()` starts a run from script.

## R0 calibration

Users enter R0. The contact rates the engine needs are derived from it in
`src/r0.js`, and the sidebar shows the derived values.

- **School:** only prodromal cases are infectious, so
  `contact_rate = R0 / (transmission_probability × prodromal_period)`. This is
  the formula behind the Shiny default of 15/0.99/4.
- **Community:** a person in group *i* contacts each infectious person in
  group *j* with probability `C[i][j] / N_j`.
  - Cases are infectious while prodromal, and also while they have a rash.
    During the rash their contacts are scaled by `1 − "rash contact reduction"`,
    and the rash ends by recovery or hospitalization.
  - So the mean infectious period is
    `D = prodromal + (1 − reduction) / (1/rash + hospitalization_rate)`, and
    `R0 = p × D × ρ(C)`, where ρ is the spectral radius of the matrix.
  - The matrix is rescaled to the target R0, which keeps its shape. Turning
    calibration off uses the matrix as entered and shows the R0 it implies.

The sidebar also shows the effective R at the start of the outbreak,
`R0 × (1 − coverage × efficacy)`, and the herd-immunity threshold.

`test/unit/engine.test.js` checks the calibration against simulation: the
mean number of secondary cases of the index cases matches R0 within 10% for
both models.

## Data

- **Schools:** `data-raw/schools_measles.csv` (from epiworldRShiny), split by
  state into `public/data/schools/` by `npm run data`.
- **Populations:** each `public/data/populations/<id>.json` has
  `{id, name, source, notes, groups: [{name, size}], contact_matrix}`, and
  `index.json` lists them.
  - `contact_matrix[i][j]` is the average number of daily contacts a person in
    group *i* has with people in group *j*.
  - Adding a preset (e.g., census-based age groups for a county with an
    Epistorm contact matrix) only needs a new file and an index entry. No code
    changes.
- **Parameters:** `public/data/parameters.json` is the table under "Model
  assumptions & references" in each model's description: every parameter,
  the value the dashboard uses, the
  [measles package's default](https://github.com/UofUEpiBio/measles/blob/main/inst/extdata/measles_parameters.csv),
  the source, its verification status and why the dashboard differs.
  `npm run parameters` rebuilds it with `scripts/sync-parameters.mjs`, from
  the package's canonical CSV (or a local copy passed as an argument) and the
  defaults in `src/params.js`. Run it after changing a default or when the
  package's table changes; a unit test fails if the file is out of date with
  `src/params.js`.

## Tests

```sh
npm test            # unit tests + engine tests (epiworldjs in Node), incl. the R0 check
npm run test:e2e    # Playwright on the built site (npm run build first; PW_CHANNEL=chrome to use Chrome)
npm run test:native # native C++ vs WebAssembly, see below
```

Pull requests get a comment with a downloadable build of the site
(`.github/workflows/pr-preview.yml`).

`npm run test:native` checks that the WebAssembly engine reproduces the C++
library exactly:

1. `scripts/dump-specs.mjs` writes a set of the dashboard's own specs (school
   and mixing; calibrated, uncalibrated, and with rash infectiousness).
2. `test/native/compare.cpp` builds those models **directly with the measles
   C++ constructors** and runs epiworld's `run_multiple()`.
3. The test then requires every output table (`total_hist`, `transition`,
   `active_cases`, `outbreak_size`, `hospitalizations`) to be identical to the
   epiworldjs run, value for value.

The native build needs:

- clang with libc++, the standard library Emscripten uses, so the random
  distributions match.
- The epiworldjs sources at the version installed from npm, for their vendored
  headers. Point `EPIWORLDJS_DIR` at them (default: a sibling `../epiworldjs`
  checkout). CI checks out the matching tag.
