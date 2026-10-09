# Changelog

All notable changes to this project are documented here. The project follows
[semantic versioning](https://semver.org/); releases are published on
[GitHub](https://github.com/EpiForeSITE/measles-dashboard/releases).

## 0.2.0 (unreleased)

- "Model assumptions & references": a disclosure, closed by default, at the
  end of each model's description. It lists every parameter (inputs and fixed
  values), the value used, the measles package's default, the source and
  why the dashboard differs. It is built from the
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
