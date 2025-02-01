#include "HybridPdfiumUtilSpec.hpp"

namespace margelo::nitro::pdfium {

    class HybridPdfiumUtil: public HybridPdfiumUtilSpec {
        public:
            HybridPdfiumUtil() : HybridObject(TAG), HybridPdfiumUtilSpec() {}
            
            double add(double a, double b) override;
    };
}