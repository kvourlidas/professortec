declare module 'pdfmake/build/pdfmake' {
  const pdfMake: {
    createPdf: (docDefinition: any, options?: any) => {
      download: (filename?: string) => Promise<void>;
      open: (win?: Window | null) => Promise<void>;
      getBlob: () => Promise<Blob>;
    };
    addFontContainer: (fontContainer: any) => void;
    fonts: Record<string, unknown>;
  };
  export default pdfMake;
}

declare module 'pdfmake/build/fonts/Roboto' {
  const fontContainer: any;
  export default fontContainer;
}
