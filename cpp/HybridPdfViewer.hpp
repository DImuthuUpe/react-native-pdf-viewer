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
       
        double sum(double a, double b) override;
        std::shared_ptr<ArrayBuffer> getBitmap(const std::string& filePath, double width, double height, double x, double y) override;
        double getPageCount(const std::string& filePath) override;
        std::vector<std::tuple<double, double>> getAllPageDimensions(const std::string& filePath) override;
        
        std::shared_ptr<ArrayBuffer> getTile(const std::string& filePath, double pageNumber, double row, double column, double displayWidth, double tileSize, double scale, double version, double tiles) override;
        ~HybridPdfViewer() {
            FPDF_DestroyLibrary();
        }
    private:
        std::shared_ptr<ArrayBuffer> wrappingArrayBuffer;
    };
} // namespace margelo::nitro::pdfviewer
