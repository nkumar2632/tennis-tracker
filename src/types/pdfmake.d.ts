// pdfmake 0.3 ships no TypeScript types; this covers the parts the app uses.
declare module 'pdfmake' {
  interface OutputDocument {
    getBlob(): Promise<Blob>;
    getBuffer(): Promise<Buffer>;
  }
  interface PdfMake {
    createPdf(docDefinition: object): OutputDocument;
    addFonts(fonts: Record<string, Record<string, string>>): void;
    addFontContainer(container: unknown): void;
  }
  const pdfMake: PdfMake;
  export default pdfMake;
}

declare module 'pdfmake/build/standard-fonts/Helvetica.js' {
  const fontContainer: unknown;
  export default fontContainer;
}
