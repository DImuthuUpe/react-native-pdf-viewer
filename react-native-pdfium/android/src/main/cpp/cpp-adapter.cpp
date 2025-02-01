#include <jni.h>
#include "NitroPdfiumOnLoad.hpp"

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void*) {
  return margelo::nitro::pdfium::initialize(vm);
}
