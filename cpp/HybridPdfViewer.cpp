#include "HybridPdfViewer.hpp"

namespace margelo::nitro::pdfviewer {

double HybridPdfViewer::sum(double a, double b) {
    return a + b;
}

std::shared_ptr<ArrayBuffer> HybridPdfViewer::getBitmap(const std::string& filePath,
                                                       double width,
                                                       double height,
                                                       double x,
                                                       double y) {
    
    
    const char* pdf_path = filePath.c_str();
    FPDF_DOCUMENT pdfDoc = FPDF_LoadDocument(pdf_path, nullptr);

    if (!pdfDoc) {
        std::cerr << "Failed to load the PDF document." << std::endl;
    }
    
    FPDF_PAGE page = FPDF_LoadPage(pdfDoc, (int)1);
    if (!page) {
        std::cerr << "Failed to load the page for document." << std::endl;

    }
    
    int stride = width * 4;
    FPDF_BITMAP bitmapHandle = FPDFBitmap_CreateEx(width, height, FPDFBitmap_BGRA, publ, stride);
                 
    if (!bitmapHandle) {
        std::cerr << "Failed to load the bitmap handle for document." << std::endl;

    }
                 
     FPDFBitmap_FillRect(bitmapHandle, 0, 0, width, height, 0xffffffff);
     FPDF_RenderPageBitmap(bitmapHandle, page, 0, 0, width, height, 0, 0);

     FPDFBitmap_Destroy(bitmapHandle);
     FPDF_ClosePage(page);

    if (pdfDoc) {
        std::cout << "Closed document on path " << filePath << std::endl;
        FPDF_CloseDocument(pdfDoc);
    }
    
    return wrappingArrayBuffer;
}

} // namespace margelo::nitro::pdfviewer
