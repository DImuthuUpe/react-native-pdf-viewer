#pragma once
#include <vector>
#include "HybridPdfViewerSpec.hpp"
#include "fpdfview.h"

namespace margelo::nitro::pdfviewer {
class HybridPdfViewer : public HybridPdfViewerSpec {
    public:
        HybridPdfViewer() : HybridObject(TAG), HybridPdfViewerSpec() {
            len = 1024 * 1024 * 4; // Initialize the length
            publ = new uint8_t[len]; // Allocate memory
            wrappingArrayBuffer = ArrayBuffer::wrap(publ, len, [=]() {
                delete[] publ; // Cleanup lambda
            });
            FPDF_InitLibrary();
        }
       
        double sum(double a, double b) override;
        std::shared_ptr<ArrayBuffer> getBitmap(const std::string& filePath, double width, double height, double x, double y) override;

        ~HybridPdfViewer() {
            FPDF_DestroyLibrary();
        }
    private:
        size_t len;
        uint8_t* publ;
        std::shared_ptr<ArrayBuffer> wrappingArrayBuffer;
    };
} // namespace margelo::nitro::pdfviewer
