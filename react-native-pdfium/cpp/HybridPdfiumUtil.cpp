#include "HybridPdfiumUtil.hpp"

namespace margelo::nitro::pdfium {

    FPDF_PAGE HybridPdfiumUtil::getPage(FPDF_DOCUMENT m_pdfDoc, int pageIndex) {
        // Check if the page is already cached
        auto it =  m_pageCache.find(pageIndex);
        if (it != m_pageCache.end()) {
            return it->second;
        }
        
        // Not in cache; load the page
        FPDF_PAGE page = FPDF_LoadPage(m_pdfDoc, pageIndex);
        if (page) {
            // Cache the page handle for later use
            m_pageCache[pageIndex] = page;
        }
        return page;
    }

    void HybridPdfiumUtil::clearPageCache() {
        for (auto& entry : m_pageCache) {
            FPDF_ClosePage(entry.second);
        }
        m_pageCache.clear();
    }


    double HybridPdfiumUtil::add(double a, double b) {
        return a + b;
    }

    double HybridPdfiumUtil::getPageCount() {
        
        if (m_pdfDoc == nullptr) {
            std::cerr << "Failed to load the PDF document." << std::endl;
            return 0;
        }
        
        int page_count = FPDF_GetPageCount(m_pdfDoc);
        
        return page_count;
    }

    std::vector<std::tuple<double, double, double>> HybridPdfiumUtil::getAllPageDimensions() {
        
        // Vector to store dimensions
        // We do not have to explicitly free memory as std::vector is returned by value
        std::vector<std::tuple<double, double, double>> pageDimensions;
        
        if (m_pdfDoc == nullptr) {
            std::cerr << "No PDF document was loaded" << std::endl;
            return pageDimensions;
        }
        
        // Get the total number of pages
        int pageCount = FPDF_GetPageCount(m_pdfDoc);

        double aggregatedHeight = 0;
        // Iterate over all pages
        for (int i = 0; i < pageCount; ++i) {
            // Load the page
            FPDF_PAGE page = getPage(m_pdfDoc, i);
            if (!page) {
                std::cerr << "Failed to load page " << i << "." << std::endl;
                continue;
            }

            // Get the width and height of the page
            double width = FPDF_GetPageWidth(page);
            double height = FPDF_GetPageHeight(page);
            aggregatedHeight += height;
            // Store the dimensions
            pageDimensions.emplace_back(width, height, aggregatedHeight);
        }

        return pageDimensions;
    }


    void HybridPdfiumUtil::openPdf(const std::string& filePath) {
        std::cout << "Openning pdf " << filePath << std::endl;
        if (m_pdfDoc != nullptr) {
            closePdf();
        }
        const char* pdf_path = filePath.c_str();
        m_pdfDoc = FPDF_LoadDocument(pdf_path, nullptr);
    }

    void HybridPdfiumUtil::closePdf() {
        std::cout << "Closing pdf " << std::endl;
        clearPageCache();
        if (m_pdfDoc!= nullptr) {
            FPDF_CloseDocument(m_pdfDoc);
        }
    }

    std::shared_ptr<ArrayBuffer> HybridPdfiumUtil::getTile(double pageNumber, double row, double column, double displayWidth, double tileWidthD, double tileHeightD, double scale) {
        
        
        int tileWidth = (int)tileWidthD;
        int tileHeight = (int)tileHeightD;
        size_t len = tileWidth * tileHeight * 4; // Initialize the length. 4 bytes are for RGBA chanels for each pixel
        uint8_t* stream = new uint8_t[len]; // Allocate internal memory
        std::shared_ptr<ArrayBuffer> buf = ArrayBuffer::wrap(stream, len, [=]() {
            // This will clean up when the reference count is 0. Which means when the JS thread runs the GC cycle
            delete[] stream; // Cleanup lambda
        });
        
        
        if (!m_pdfDoc) {
            std::cerr << "Failed to load the PDF document." << std::endl;
            return buf;
        }
        
        
        FPDF_PAGE page = getPage(m_pdfDoc, (int)pageNumber);
        if (!page) {
            std::cerr << "Failed to load the page " << pageNumber << " for document." << std::endl;
            return buf;
        }
        
        double width = FPDF_GetPageWidth(page);
        double height = FPDF_GetPageHeight(page);
        int stride = tileWidth * 4;
        FPDF_BITMAP bitmapHandle = FPDFBitmap_CreateEx(tileWidth, tileHeight, FPDFBitmap_BGRA, buf->data(), stride);
                    
        if (!bitmapHandle) {
            std::cerr << "Failed to load the bitmap handle for document." << std::endl;
            return buf;
        }
                    
        FPDFBitmap_FillRect(bitmapHandle, 0, 0, tileWidth, tileHeight, 0xffffffff);
        
        float xScale = scale;//  * displayWidth / width;
        float yScale = scale;//  * displayWidth / width;
        float xTranslate = (float)column;
        float yTranslate = (float)row;
        std::thread::id this_id = std::this_thread::get_id();
        //std::cout << "[Thread " << this_id << "] Page " << pageNumber << " matric scale "
        //        << scale << " xTranslate " << xTranslate << " yTranslate " << yTranslate << std::endl;
        FS_MATRIX matrix = {xScale, 0.0, 0.0, yScale, xTranslate, yTranslate}; // Flipped Y-axis.
        FS_RECTF clip = {0, 0, (float)tileWidthD, (float)tileHeightD};

        FPDF_RenderPageBitmapWithMatrix(bitmapHandle, page, &matrix, &clip, 0);
        
        FPDFBitmap_Destroy(bitmapHandle);
        return buf;
    }

    std::shared_ptr<ArrayBuffer> HybridPdfiumUtil::getTileBgr565(double pageNumber, double row, double column, double displayWidth, double tileWidthD, double tileHeightD, double scale) {
        
        
        int tileWidth = (int)tileWidthD;
        int tileHeight = (int)tileHeightD;
        
        uint8_t* bgrStream = new uint8_t[tileWidth * tileHeight * 3]; // Allocate internal memory
        uint8_t* rgb565Stream = new uint8_t[tileWidth * tileHeight * 2]; // Allocate internal memory
        std::shared_ptr<ArrayBuffer> buf = ArrayBuffer::wrap(rgb565Stream, tileWidth * tileHeight * 2, [=]() {
            // This will clean up when the reference count is 0. Which means when the JS thread runs the GC cycle
            delete[] rgb565Stream; // Cleanup lambda
        });
        
        
        if (!m_pdfDoc) {
            std::cerr << "Failed to load the PDF document." << std::endl;
            return buf;
        }
        
        
        FPDF_PAGE page = getPage(m_pdfDoc, (int)pageNumber);
        if (!page) {
            std::cerr << "Failed to load the page " << pageNumber << " for document." << std::endl;
            return buf;
        }
        
        //ouble width = FPDF_GetPageWidth(page);
        //double height = FPDF_GetPageHeight(page);
        int stride = tileWidth * 3;
        FPDF_BITMAP bitmapHandle = FPDFBitmap_CreateEx(tileWidth, tileHeight, FPDFBitmap_BGR, bgrStream, stride);
                    
        if (!bitmapHandle) {
            std::cerr << "Failed to load the bitmap handle for document." << std::endl;
            return buf;
        }
                    
        FPDFBitmap_FillRect(bitmapHandle, 0, 0, tileWidth, tileHeight, 0xffffffff);
        
        float xScale = scale;//  * displayWidth / width;
        float yScale = scale;//  * displayWidth / width;
        float xTranslate = (float)column;
        float yTranslate = (float)row;
        //std::thread::id this_id = std::this_thread::get_id();
        //std::cout << "[Thread " << this_id << "] Page " << pageNumber << " matric scale "
        //        << scale << " xTranslate " << xTranslate << " yTranslate " << yTranslate << std::endl;
        FS_MATRIX matrix = {xScale, 0.0, 0.0, yScale, xTranslate, yTranslate}; // Flipped Y-axis.
        FS_RECTF clip = {0, 0, (float)tileWidthD, (float)tileHeightD};

        FPDF_RenderPageBitmapWithMatrix(bitmapHandle, page, &matrix, &clip, 0);
        
        FPDFBitmap_Destroy(bitmapHandle);
        
        for (int i = 0; i < tileWidth * tileHeight; ++i) {
            // Get B, G, and R from the BGR stream.
            uint8_t b = bgrStream[3 * i];       // Blue channel
            uint8_t g = bgrStream[3 * i + 1];     // Green channel
            uint8_t r = bgrStream[3 * i + 2];     // Red channel

            // Convert 8-bit channels into RGB565 format.
            // For RGB565: 5 bits for Red, 6 bits for Green, 5 bits for Blue.
            // Option 1: Using bit shifts:
            uint16_t r565 = r >> 3;             // 5 bits for red
            uint16_t g565 = g >> 2;             // 6 bits for green
            uint16_t b565 = b >> 3;             // 5 bits for blue
            uint16_t pixel565 = (r565 << 11) | (g565 << 5) | b565;

            // Option 2: Alternatively, you can use masking and shifting:
            // uint16_t pixel565 = ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3);

            // Store the 16-bit pixel into the output stream.
            // Here, we store the high byte first, followed by the low byte.
            rgb565Stream[2 * i]     = pixel565 >> 8;    // High byte
            rgb565Stream[2 * i + 1] = pixel565 & 0xFF;   // Low byte
        }
        
        delete[] bgrStream;
        
        
        return buf;
    }
}
