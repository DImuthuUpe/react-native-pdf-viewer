#pragma once
#include <vector>
#include "HybridPdfViewerSpec.hpp"

namespace margelo::nitro::pdfviewer {
class HybridPdfViewer : public HybridPdfViewerSpec {
    public:
        HybridPdfViewer() : HybridObject(TAG), HybridPdfViewerSpec() {}
       
        double sum(double a, double b) override;
    };
} // namespace margelo::nitro::pdfviewer
