# Builds the native C++ reference runner against the epiworld and measles
# headers vendored in epiworldjs, with the same toolchain settings as
# epiworldjs's `golden` target: clang with libc++ (the standard library
# Emscripten ships, so std::*_distribution draws match) and no FP
# contraction.
#
#   make EPIWORLDJS_DIR=/path/to/epiworldjs   (default: a sibling checkout)

EPIWORLDJS_DIR ?= ../../../epiworldjs
CXX := clang++
CXXFLAGS := -O2 -std=c++17 -stdlib=libc++ -ffp-contract=off -Wall \
	-I$(EPIWORLDJS_DIR)/vendor/epiworld -I$(EPIWORLDJS_DIR)/vendor

../../build/compare: compare.cpp $(shell find $(EPIWORLDJS_DIR)/vendor -name '*.hpp' 2>/dev/null)
	@test -f $(EPIWORLDJS_DIR)/vendor/measles/measles.hpp || \
		(echo "epiworldjs headers not found in $(EPIWORLDJS_DIR)/vendor; set EPIWORLDJS_DIR" && exit 1)
	@mkdir -p $(@D)
	$(CXX) $(CXXFLAGS) $< -o $@
