# Raw data

`schools_measles.csv` is copied from epiworldRShiny
(`inst/extdata/schools_measles.csv`), which combines MMR vaccination rates
from epiENGAGE/TACC's [measles-dashboard](https://github.com/TACC/measles-dashboard)
(25 states) with Utah DHHS school data. Enrollment (`num_students`) is not
available, so it is empty for every school.

`npm run data` converts it into the per-state JSON files under
`public/data/schools/` that the dashboard loads on demand (rates are clamped to
[0, 1]; one school in the source is above 1).
