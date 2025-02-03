#pragma once
#include <vector>
#include "HybridPdfiumUtilSpec.hpp"
#include "fpdfview.h"
#include "fpdf_text.h"

namespace margelo::nitro::pdfium {

    class HybridPdfiumUtil: public HybridPdfiumUtilSpec {
        public:
        HybridPdfiumUtil() : HybridObject(TAG), HybridPdfiumUtilSpec(), m_pdfDoc(nullptr) {
                FPDF_InitLibrary();
            }
            
            double add(double a, double b) override;
            void openPdf(const std::string& filePath) override;
            void closePdf() override;
            double getPageCount() override;
            std::vector<std::tuple<double, double>> getAllPageDimensions() override;
            
            std::shared_ptr<ArrayBuffer> getTile(double pageNumber, double row, double column, double displayWidth, double tileSize, double scale) override;
            ~HybridPdfiumUtil() {
                clearPageCache();
                if (m_pdfDoc != nullptr) {
                    FPDF_CloseDocument(m_pdfDoc);  // Clean up the loaded document resource
                }
                FPDF_DestroyLibrary();
            }
    private:
        FPDF_DOCUMENT m_pdfDoc;
        std::unordered_map<int, FPDF_PAGE> m_pageCache;
        FPDF_PAGE getPage(FPDF_DOCUMENT m_pdfDoc, int pageIndex);
        void clearPageCache();

    };
}
