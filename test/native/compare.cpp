// Native reference runner for the dashboard's specs.
//
// Reads test/native/specs.txt (written by scripts/dump-specs.mjs), builds
// each measles model directly with its C++ constructor (not through
// epiworldjs's registry, so the dashboard's parameter mapping is checked
// too), runs epiworld's run_multiple() and prints every requested output
// table. Doubles are printed with %.17g, which round-trips exactly.
//
// Usage: compare specs.txt > native.txt

#include <cmath>
#include <cstdio>
#include <fstream>
#include <iostream>
#include <map>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>

#include "epiworld.hpp"
#include "measles/measles.hpp"

using epiworld::OutputTable;
using epiworld::RunOutputs;
using Model = epiworld::Model<>;

namespace {

struct Spec {
    std::string name, model;
    int n = 0, ndays = 0, nsims = 0, seed = 0;
    double prevalence = 0.0;
    std::map<std::string, double> params;
    std::vector<int> groups;
    std::vector<double> matrix; // row-major, [i][j] = contacts of group i with group j
    std::vector<std::string> outputs;

    double par(const std::string & key) const {
        auto it = params.find(key);
        if (it == params.end())
            throw std::invalid_argument(name + ": missing parameter \"" + key + "\"");
        return it->second;
    }
};

std::vector<Spec> read_specs(const char * path) {
    std::ifstream in(path);
    if (!in)
        throw std::runtime_error(std::string("Cannot open ") + path);
    std::vector<Spec> out;
    Spec cur;
    std::string line;
    while (std::getline(in, line)) {
        if (line.empty())
            continue;
        auto space = line.find(' ');
        std::string key = line.substr(0, space);
        std::string rest = space == std::string::npos ? "" : line.substr(space + 1);
        std::istringstream values(rest);
        if (key == "spec") cur = Spec{}, cur.name = rest;
        else if (key == "model") cur.model = rest;
        else if (key == "n") cur.n = std::stoi(rest);
        else if (key == "prevalence") cur.prevalence = std::strtod(rest.c_str(), nullptr);
        else if (key == "ndays") cur.ndays = std::stoi(rest);
        else if (key == "nsims") cur.nsims = std::stoi(rest);
        else if (key == "seed") cur.seed = std::stoi(rest);
        else if (key == "param") {
            auto eq = rest.rfind('=');
            cur.params[rest.substr(0, eq)] = std::strtod(rest.c_str() + eq + 1, nullptr);
        } else if (key == "groups") {
            for (int g; values >> g;) cur.groups.push_back(g);
        } else if (key == "matrix") {
            for (std::string x; values >> x;) cur.matrix.push_back(std::strtod(x.c_str(), nullptr));
        } else if (key == "outputs") {
            for (std::string o; values >> o;) cur.outputs.push_back(o);
        } else if (key == "end") out.push_back(cur);
        else throw std::invalid_argument("Unknown key: " + key);
    }
    return out;
}

std::unique_ptr<Model> build(const Spec & s) {
    std::unique_ptr<Model> model;
    if (s.model == "MeaslesSchool") {
        model = std::make_unique<measles::ModelMeaslesSchool<>>(
            static_cast<epiworld_fast_uint>(s.n),
            static_cast<epiworld_fast_uint>(std::lround(s.prevalence * s.n)),
            s.par("Contact rate"), s.par("Transmission rate"), s.par("Vax efficacy"),
            0.5, // vax_reduction_recovery_rate (ignored by the model)
            s.par("Incubation period"), s.par("Prodromal period"), s.par("Rash period"),
            s.par("Days undetected"), s.par("Hospitalization rate"), s.par("Hospitalization period"),
            s.par("Vaccination rate"),
            static_cast<epiworld_fast_int>(s.par("Quarantine period")),
            s.par("Quarantine willingness"),
            static_cast<epiworld_fast_int>(s.par("Isolation period")));
    } else if (s.model == "MeaslesMixing") {
        const size_t g = s.groups.size();
        if (s.matrix.size() != g * g)
            throw std::invalid_argument(s.name + ": matrix size does not match groups");
        std::vector<double> column_major(g * g);
        for (size_t i = 0; i < g; ++i)
            for (size_t j = 0; j < g; ++j)
                column_major[j * g + i] = s.matrix[i * g + j];
        model = std::make_unique<measles::ModelMeaslesMixing<>>(
            static_cast<epiworld_fast_uint>(s.n), s.prevalence,
            s.par("Transmission rate"), s.par("Vax efficacy"),
            0.5, // vax_reduction_recovery_rate (ignored by the model)
            s.par("Incubation period"), s.par("Prodromal period"), s.par("Rash period"),
            column_major,
            s.par("Hospitalization rate"), s.par("Hospitalization period"),
            s.par("Days undetected"),
            static_cast<epiworld_fast_int>(s.par("Quarantine period")),
            s.par("Quarantine willingness"), s.par("Isolation willingness"),
            static_cast<epiworld_fast_int>(s.par("Isolation period")),
            s.par("Vaccination rate"), s.par("Contact tracing success rate"),
            static_cast<epiworld_fast_uint>(s.par("Contact tracing days window")),
            s.par("Rash reduction contact rate"));
    } else {
        throw std::invalid_argument(s.name + ": unknown model " + s.model);
    }

    model->verbose_off();
    model->seed(static_cast<size_t>(s.seed));

    int from = 0;
    for (size_t i = 0; i < s.groups.size(); ++i) {
        model->add_entity(epiworld::Entity<>("Group " + std::to_string(i + 1),
            epiworld::distribute_entity_to_range<>(from, from + s.groups[i])));
        from += s.groups[i];
    }
    return model;
}

std::string cell(const OutputTable::Column & column, size_t i) {
    return std::visit([i](const auto & values) -> std::string {
        using T = typename std::decay_t<decltype(values)>::value_type;
        if constexpr (std::is_same_v<T, std::string>) {
            return values[i];
        } else if constexpr (std::is_same_v<T, double>) {
            char buffer[32];
            std::snprintf(buffer, sizeof buffer, "%.17g", values[i]);
            return buffer;
        } else {
            return std::to_string(values[i]);
        }
    }, column);
}

} // namespace

int main(int argc, char ** argv) {
    if (argc < 2) {
        std::fprintf(stderr, "Usage: %s specs.txt\n", argv[0]);
        return 2;
    }
    try {
        for (const auto & spec : read_specs(argv[1])) {
            auto model = build(spec);
            epiworld::SaverMemory saver(spec.outputs);
            model->run_multiple(static_cast<epiworld_fast_uint>(spec.ndays),
                static_cast<epiworld_fast_uint>(spec.nsims), spec.seed, saver, true, false, 1);
            const RunOutputs outputs = saver.results();

            std::printf("# %s\n", spec.name.c_str());
            for (const auto & name : spec.outputs) {
                const auto & table = outputs.at(name);
                std::printf("## %s\n", name.c_str());
                for (size_t j = 0; j < table.colnames.size(); ++j)
                    std::printf("%s%s", j ? "\t" : "", table.colnames[j].c_str());
                std::printf("\n");
                for (size_t i = 0; i < table.nrow(); ++i) {
                    for (size_t j = 0; j < table.columns.size(); ++j)
                        std::printf("%s%s", j ? "\t" : "", cell(table.columns[j], i).c_str());
                    std::printf("\n");
                }
            }
        }
    } catch (const std::exception & e) {
        std::fprintf(stderr, "compare: %s\n", e.what());
        return 1;
    }
    return 0;
}
