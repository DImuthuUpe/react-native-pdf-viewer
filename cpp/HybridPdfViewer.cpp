#include "HybridPdfViewer.hpp"

namespace margelo::nitro::pdfviewer {

double HybridPdfViewer::sum(double a, double b) {
    return a + b;
}

double HybridPdfViewer::getPageCount(const std::string& filePath) {
    const char* pdf_path = filePath.c_str();
    FPDF_DOCUMENT pdfDoc = FPDF_LoadDocument(pdf_path, nullptr);

    if (!pdfDoc) {
        std::cerr << "Failed to load the PDF document." << std::endl;
    }
    
    int page_count = FPDF_GetPageCount(pdfDoc);
    
    if (pdfDoc) {
        std::cout << "Closed document on path " << filePath << std::endl;
        FPDF_CloseDocument(pdfDoc);
    }
    
    return page_count;
}

std::vector<std::tuple<double, double>> HybridPdfViewer::getAllPageDimensions(const std::string& filePath) {
    const char* pdf_path = filePath.c_str();
    FPDF_DOCUMENT pdfDoc = FPDF_LoadDocument(pdf_path, nullptr);

    if (!pdfDoc) {
        std::cerr << "Failed to load the PDF document." << std::endl;
    }
    
    // Get the total number of pages
    int pageCount = FPDF_GetPageCount(pdfDoc);

    // Vector to store dimensions
    std::vector<std::tuple<double, double>> pageDimensions;

    // Iterate over all pages
    for (int i = 0; i < pageCount; ++i) {
        // Load the page
        FPDF_PAGE page = FPDF_LoadPage(pdfDoc, i);
        if (!page) {
            std::cerr << "Failed to load page " << i << "." << std::endl;
            continue;
        }

        // Get the width and height of the page
        double width = FPDF_GetPageWidth(page);
        double height = FPDF_GetPageHeight(page);

        // Store the dimensions
        pageDimensions.emplace_back(width, height);

        // Close the page
        FPDF_ClosePage(page);
    }

    // Close the PDF document
    FPDF_CloseDocument(pdfDoc);

    return pageDimensions;

}

std::shared_ptr<ArrayBuffer> HybridPdfViewer::getTile(const std::string& filePath, double pageNumber, double row, double column,
                            double displayWidth, double tileSizeD, double scale, double version, double tiles) {
    
    
    int tileSize = (int)tileSizeD;
    size_t len = tileSize * tileSize * 4; // Initialize the length
    uint8_t* stream = new uint8_t[len]; // Allocate memory
    std::shared_ptr<ArrayBuffer> buf = ArrayBuffer::wrap(stream, len, [=]() {
        std::cout << "Clearing the buffer version "<< version << " tiles " << tiles <<" row " << row << " column " << column << std::endl;
        delete[] stream; // Cleanup lambda
    });
    
    
    const char* pdf_path = filePath.c_str();
    FPDF_DOCUMENT pdfDoc = FPDF_LoadDocument(pdf_path, nullptr);

    if (!pdfDoc) {
        std::cerr << "Failed to load the PDF document." << std::endl;
    }
    
    FPDF_PAGE page = FPDF_LoadPage(pdfDoc, (int)pageNumber);
    if (!page) {
        std::cerr << "Failed to load the page for document." << std::endl;
    }
    
    double width = FPDF_GetPageWidth(page);
    double height = FPDF_GetPageHeight(page);
    std::cout << "Scale " << scale << " Page width " << width << " height " << height << "display width " << displayWidth << std::endl;
    int stride = tileSize * 4;
    FPDF_BITMAP bitmapHandle = FPDFBitmap_CreateEx(tileSize, tileSize, FPDFBitmap_BGRA, buf->data(), stride);
                 
    if (!bitmapHandle) {
        std::cerr << "Failed to load the bitmap handle for document." << std::endl;

    }
                 
    FPDFBitmap_FillRect(bitmapHandle, 0, 0, tileSize, tileSize, 0xffffffff);
    
    float xScale = scale * 2  * displayWidth / width;
    float yScale = scale * 2  * displayWidth / width;
    float xTranslate = column * tileSizeD;
    float yTranslate = row * tileSizeD;
    std::cout << "Page matric scale " << scale << " xTranslate " << xTranslate << " yTranslate " << yTranslate << std::endl;
    FS_MATRIX matrix = {xScale, 0.0, 0.0, yScale, xTranslate, yTranslate}; // Flipped Y-axis.
    FS_RECTF clip = {0, 0, (float)tileSize, (float)tileSize};

    FPDF_RenderPageBitmapWithMatrix(bitmapHandle, page, &matrix, &clip, 0);
    
    FPDFBitmap_Destroy(bitmapHandle);
    FPDF_ClosePage(page);

    if (pdfDoc) {
       //std::cout << "Closed document 4 on path " << filePath << std::endl;
       FPDF_CloseDocument(pdfDoc);
    }
     
    
    
    return buf;
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
    FPDF_BITMAP bitmapHandle = FPDFBitmap_CreateEx(width, height, FPDFBitmap_BGRA, wrappingArrayBuffer->data(), stride);
                 
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
