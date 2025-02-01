import { type HybridObject } from 'react-native-nitro-modules'

export interface PdfiumUtil extends HybridObject<{ ios: 'c++', android: 'c++' }> {
    add(a: number, b: number): number
    openPdf(filePath: string): void
    closePdf(): void
    getTile(pageNumber: number, row: number, column: number, displayWidth: number, tileSize: number, scale: number): ArrayBuffer
    getPageCount(filePath: string): number
    getAllPageDimensions(filePath: string): [number, number][]
}