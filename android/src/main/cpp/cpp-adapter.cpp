#include <jni.h>
#include "PdfViewerOnLoad.hpp"

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void*) {
  return margelo::nitro::pdfviewer::initialize(vm);
}
