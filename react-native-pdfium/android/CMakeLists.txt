project(NitroPdfium)
cmake_minimum_required(VERSION 3.9.0)

set (PACKAGE_NAME NitroPdfium)
set (CMAKE_VERBOSE_MAKEFILE ON)
set (CMAKE_CXX_STANDARD 20)

# Define C++ library and add all sources
add_library(${PACKAGE_NAME} SHARED
        src/main/cpp/cpp-adapter.cpp
        ../cpp/HybridPdfiumUtil.cpp
        ../cpp/HybridPdfiumUtil.hpp
)

# Add Nitrogen specs :)
include(${CMAKE_SOURCE_DIR}/../nitrogen/generated/android/NitroPdfium+autolinking.cmake)

# Set up local includes
include_directories(
        "src/main/cpp"
        "../cpp"
        "../pdfiumlibs/android/include"
)

find_library(LOG_LIB log)

# Import PDFium as a prebuilt shared library
add_library(pdfium SHARED IMPORTED)
set_target_properties(pdfium PROPERTIES
    IMPORTED_LOCATION "${CMAKE_SOURCE_DIR}/../pdfiumlibs/android/lib/${ANDROID_ABI}/libpdfium.so"
)

# Link all libraries together
target_link_libraries(
        ${PACKAGE_NAME}
        ${LOG_LIB}
        android                                   # <-- Android core
        pdfium
)
