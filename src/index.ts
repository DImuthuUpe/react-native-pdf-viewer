import { NitroModules } from 'react-native-nitro-modules'
import type { PdfViewer as PdfViewerSpec } from './specs/pdf-viewer.nitro'

export const PdfViewer =
  NitroModules.createHybridObject<PdfViewerSpec>('PdfViewer')