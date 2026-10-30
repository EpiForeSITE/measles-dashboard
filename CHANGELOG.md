# Changelog

All notable changes to this project are documented here. The project follows
[semantic versioning](https://semver.org/); releases are published on
[GitHub](https://github.com/EpiForeSITE/measles-dashboard/releases).

## 0.3.0 (unreleased)

- Uses epiworldjs 0.19.0-1, with the measles models' lognormal stage
  durations (UofUEpiBio/measles#69). The incubation, prodromal and rash
  periods are drawn for each person from a lognormal with the given mean and
  the new "SD" inputs (advanced; defaults 2.5, 1.7 and 1 days, from Lessler
  et al. 2009, the 1861 Hagelloch outbreak, and an assumption). Before, each
  stage was geometric, so long stays were too common (16% of cases were still
  latent after a 21-day quarantine; now 0.2%).
- The default hospitalization rate is now 3.5% a day, about 10% of cases
  hospitalized, as in recent data (CDC 2026; 8% in Utah). It was 20% a day,
  about 37.5% of cases. Each day with rash a person is hospitalized with this
  probability; the tooltip and the parameter table give the conversion.
- The community model's R0 calibration uses the expected days with rash
  under these rules (`mixingInfectiousPeriod()` in `src/r0.js`).

## 0.2.0

- "Model assumptions & references": a disclosure, closed by default, at the
  end of each model's description. It lists every parameter (inputs and fixed
  values), the value used and its source. It is built from the
  package's canonical table by `npm run parameters`
  (`scripts/sync-parameters.mjs` → `public/data/parameters.json`); see
  EpiForeSITE/measles#5.
- Input tooltips end with a short source.
- The hospitalization tooltip now says it is a daily rate, not a probability
  (with a 3-day rash, 20% a day is about a 37.5% chance).
- The school model's "Model" link pointed to the archived epiworld-measles
  repository; it now points to the measles package's parameter table.

## 0.1.0

First release.

- Static rebuild of epiworldRShiny's measles app on epiworldjs (WebAssembly):
  school (`MeaslesSchool`) and community (`MeaslesMixing`) simulators,
  comparing outbreaks with and without quarantine.
- School search over 49,324 schools in 25 states (or an uploaded CSV) to
  fill in vaccination coverage.
- Parameterized by R0 (contact rates and contact-matrix scaling derived from
  it), checked against simulated secondary cases.
- Live, results-first interface: automatic re-runs with a quick preview for
  large runs, number tiles, epidemic curve and outbreak-size chart.
- Embeddable web components, themable with CSS custom properties and
  `::part()`, with run and selection events.
- The version is shown in the header and footer, linking to the latest
  release.
- Native C++ vs WebAssembly equivalence tests, PR previews, version checks
  with please-bump, and GitHub Pages deployment.
