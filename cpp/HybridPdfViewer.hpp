#pragma once
#include <vector>
#include "HybridPdfViewerSpec.hpp"
#include "fpdfview.h"
#include "fpdf_text.h"

namespace margelo::nitro::pdfviewer {
class HybridPdfViewer : public HybridPdfViewerSpec {
    public:
        HybridPdfViewer() : HybridObject(TAG), HybridPdfViewerSpec() {
            size_t len = 2048 * 2048 * 4; // Initialize the length
            uint8_t* publ = new uint8_t[len]; // Allocate memory
            wrappingArrayBuffer = ArrayBuffer::wrap(publ, len, [=]() {
                delete[] publ; // Cleanup lambda
            });
            FPDF_InitLibrary();
        }
       
        void openPdf(const std::string& filePath) override;
        void closePdf() override;
        double getPageCount(const std::string& filePath) override;
        std::vector<std::tuple<double, double>> getAllPageDimensions(const std::string& filePath) override;
        
        std::shared_ptr<ArrayBuffer> getTile(double pageNumber, double row, double column, double displayWidth, double tileSize, double scale) override;
        ~HybridPdfViewer() {
            FPDF_DestroyLibrary();
        }
    private:
        std::shared_ptr<ArrayBuffer> wrappingArrayBuffer;
    };
} // namespace margelo::nitro::pdfviewer
