# Changelog

All notable changes to this project are documented here. The project follows
[semantic versioning](https://semver.org/); releases are published on
[GitHub](https://github.com/EpiForeSITE/measles-dashboard/releases).

## 0.1.0 (unreleased)

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
