#include <algorithm>
#include <cstdlib>
#include <iomanip>
#include <iostream>
#include <map>
#include <string>
#include <vector>

namespace {

struct Signal {
  std::string name;
  double value;
  double weight;
};

double clamp(double value, double low = 0.0, double high = 100.0) {
  return std::max(low, std::min(high, value));
}

double parse_double(const std::map<std::string, std::string>& args,
                    const std::string& key,
                    double fallback = 0.0) {
  const auto found = args.find(key);
  if (found == args.end()) {
    return fallback;
  }

  char* end = nullptr;
  const double parsed = std::strtod(found->second.c_str(), &end);
  if (end == found->second.c_str()) {
    return fallback;
  }

  return clamp(parsed);
}

std::map<std::string, std::string> parse_args(int argc, char* argv[]) {
  std::map<std::string, std::string> args;

  for (int index = 1; index + 1 < argc; index += 2) {
    std::string key = argv[index];
    if (key.rfind("--", 0) == 0) {
      key = key.substr(2);
    }
    args[key] = argv[index + 1];
  }

  return args;
}

std::string level_from_score(double score) {
  if (score >= 67.0) {
    return "High";
  }
  if (score >= 34.0) {
    return "Moderate";
  }
  return "Low";
}

std::string dominant_contributor(const std::vector<Signal>& signals) {
  const auto top = std::max_element(
      signals.begin(), signals.end(), [](const Signal& left, const Signal& right) {
        return left.value * left.weight < right.value * right.weight;
      });

  return top == signals.end() ? "none" : top->name;
}

double weighted_score(const std::vector<Signal>& signals) {
  double weighted_total = 0.0;
  double weight_total = 0.0;

  for (const auto& signal : signals) {
    weighted_total += clamp(signal.value) * signal.weight;
    weight_total += signal.weight;
  }

  if (weight_total <= 0.0) {
    return 0.0;
  }

  return clamp(weighted_total / weight_total);
}

int available_signal_count(const std::vector<Signal>& signals) {
  return static_cast<int>(std::count_if(
      signals.begin(), signals.end(), [](const Signal& signal) {
        return signal.value > 0.0;
      }));
}

}  // namespace

int main(int argc, char* argv[]) {
  const auto args = parse_args(argc, argv);
  const std::vector<Signal> signals = {
      {"aqi", parse_double(args, "aqi"), 1.25},
      {"heat", parse_double(args, "heat"), 1.05},
      {"uv", parse_double(args, "uv"), 0.55},
      {"pollen", parse_double(args, "pollen"), 0.75},
      {"illness", parse_double(args, "illness"), 1.15},
      {"equity", parse_double(args, "equity"), 0.7},
      {"chronic", parse_double(args, "chronic"), 0.85},
      {"profile", parse_double(args, "profile"), 0.65},
      {"forecast", parse_double(args, "forecast"), 1.1},
  };

  const double score = weighted_score(signals);
  const int available_count = available_signal_count(signals);

  std::cout << std::fixed << std::setprecision(1)
            << "{"
            << "\"score\":" << score << ","
            << "\"level\":\"" << level_from_score(score) << "\","
            << "\"dominant_contributor\":\"" << dominant_contributor(signals) << "\","
            << "\"available_signals\":" << available_count << ","
            << "\"total_signals\":" << signals.size() << ","
            << "\"note\":\"Experimental transparent scoring kernel; not clinical advice.\""
            << "}\n";

  return 0;
}
