import { NitroModules } from "react-native-nitro-modules";
import type { PdfiumUtil } from "./specs/pdfium.nitro";

// TODO: Export all HybridObjects here for the user
export const PdfiumModule = NitroModules.createHybridObject<PdfiumUtil>("PdfiumUtil")