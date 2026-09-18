// Thin protocol adapter. TDL2048+ remains unchanged and is MIT licensed by Hung Guei.
// See ../TDL2048/LICENSE.md. No training, random spawns, or search is invoked here.
#define main tdl2048_original_main
#include "../TDL2048/2048.cpp"
#undef main
#include <chrono>

int main(int argc, const char* argv[]) {
    using namespace moporgic;
    if (argc != 2) return 2;
    const char* args[] = {"bridge", "-n", "4x6patt", "-i", argv[1], "-e", "1x1", "-d", "1p"};
    auto opts = parse(9, args);
    utils::config_weight(opts["alpha"]);
    utils::load_network(opts["load"]);
    utils::make_network(opts["make"]);
    if (weight::wghts().size() != 4 || feature::feats().size() != 32) return 3;
    method spec = method::parse(opts["evaluate"]);
    std::cout << "{\"ready\":true}" << std::endl;
    const char* directions[] = {"up", "right", "down", "left"};
    std::string line;
    while (std::getline(std::cin, line)) {
        std::istringstream input(line);
        board b;
        for (unsigned i = 0, rank; i < 16; i++) {
            if (!(input >> rank) || rank > 15) return 4;
            b.at(i, rank);
        }
        auto started = std::chrono::steady_clock::now();
        moporgic::select selected;
        selected(b, feature::feats(), spec);
        double ms = std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now()-started).count();
        std::cout << std::setprecision(17) << "{\"direction\":";
        if (selected) std::cout << '"' << directions[selected.opcode()] << '"'; else std::cout << "null";
        std::cout << ",\"compute_ms\":" << ms << ",\"options\":[";
        bool first = true;
        for (unsigned d=0; d<4; d++) {
            auto& s=selected.move[d];
            if (s.info() == -1u) continue;
            if (!first) std::cout << ',';
            first=false;
            std::cout << "{\"direction\":\"" << directions[d] << "\",\"value\":" << s.esti
                      << ",\"gain\":" << s.score() << ",\"afterstate\":[";
            for(unsigned i=0;i<16;i++) { if(i)std::cout<<','; std::cout<<s.exact(i); }
            std::cout << "]}";
        }
        std::cout << "]}" << std::endl;
    }
}
