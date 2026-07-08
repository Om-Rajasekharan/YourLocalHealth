#include <algorithm>
#include <cmath>
#include <cstdlib>
#include <iomanip>
#include <iostream>
#include <map>
#include <stdexcept>
#include <string>
#include <utility>
#include <vector>

namespace {

struct Feature {
  std::string key;
  std::string label;
  double value;
  double weight;
};

struct KernelResult {
  int score;
  std::string level;
  std::string dominant;
  int confidence;
};

double clamp(double value, double low = 0.0, double high = 100.0) {
  return std::max(low, std::min(high, value));
}

int rounded_score(double value) {
  return static_cast<int>(std::round(clamp(value)));
}

std::string risk_level(int score) {
  if (score >= 67) {
    return "High";
  }
  if (score >= 34) {
    return "Moderate";
  }
  return "Low";
}

std::map<std::string, double> parse_args(int argc, char* argv[]) {
  std::map<std::string, double> values;

  for (int index = 1; index < argc; index += 1) {
    std::string flag = argv[index];
    if (flag == "--help" || flag == "-h") {
      values["__help"] = 1;
      return values;
    }

    if (flag.rfind("--", 0) != 0) {
      throw std::runtime_error("Unexpected argument: " + flag);
    }
    if (index + 1 >= argc) {
      throw std::runtime_error("Missing value for " + flag);
    }

    std::string key = flag.substr(2);
    char* end = nullptr;
    const double value = std::strtod(argv[index + 1], &end);
    if (end == argv[index + 1] || *end != '\0') {
      throw std::runtime_error("Invalid numeric value for " + flag);
    }

    values[key] = clamp(value);
    index += 1;
  }

  return values;
}

void print_help() {
  std::cout
      << "MyLocalHealth native risk kernel\n\n"
      << "Inputs are normalized 0..100 except profile, which is a 0..100 "
         "personalization lift.\n\n"
      << "Example:\n"
      << "  risk_kernel --aqi 72 --heat 61 --uv 55 --pollen 44 "
         "--illness 38 --equity 52 --chronic 48 --profile 12 --forecast 67\n";
}

double value_for(const std::map<std::string, double>& values,
                 const std::string& key) {
  auto found = values.find(key);
  if (found == values.end()) {
    return 0.0;
  }
  return found->second;
}

KernelResult score_kernel(const std::map<std::string, double>& values) {
  std::vector<Feature> features = {
      {"aqi", "air quality", value_for(values, "aqi"), 0.16},
      {"heat", "heat", value_for(values, "heat"), 0.13},
      {"uv", "UV", value_for(values, "uv"), 0.08},
      {"pollen", "pollen", value_for(values, "pollen"), 0.10},
      {"illness", "respiratory illness", value_for(values, "illness"), 0.17},
      {"equity", "health equity", value_for(values, "equity"), 0.12},
      {"chronic", "chronic burden", value_for(values, "chronic"), 0.10},
      {"forecast", "forecast peak", value_for(values, "forecast"), 0.14},
  };

  double weighted_sum = 0.0;
  double available_weight = 0.0;
  std::pair<std::string, double> dominant = {"none", 0.0};

  for (const Feature& feature : features) {
    if (values.find(feature.key) == values.end()) {
      continue;
    }

    const double contribution = feature.value * feature.weight;
    weighted_sum += contribution;
    available_weight += feature.weight;

    if (contribution > dominant.second) {
      dominant = {feature.label, contribution};
    }
  }

  const double normalized =
      available_weight > 0.0 ? weighted_sum / available_weight : 0.0;
  const double profile_lift = value_for(values, "profile") * 0.18;
  const int score = rounded_score(normalized + profile_lift);
  const int confidence = rounded_score(available_weight * 100.0);

  return {score, risk_level(score), dominant.first, confidence};
}

void print_json(const KernelResult& result) {
  std::cout << "{"
            << "\"score\":" << result.score << ","
            << "\"level\":\"" << result.level << "\","
            << "\"dominant\":\"" << result.dominant << "\","
            << "\"confidence\":" << result.confidence << "}" << std::endl;
}

}  // namespace

int main(int argc, char* argv[]) {
  try {
    const std::map<std::string, double> values = parse_args(argc, argv);
    if (values.find("__help") != values.end()) {
      print_help();
      return 0;
    }

    print_json(score_kernel(values));
    return 0;
  } catch (const std::exception& error) {
    std::cerr << "risk_kernel error: " << error.what() << std::endl;
    std::cerr << "Run with --help for usage." << std::endl;
    return 1;
  }
}
