declare module "opentype.js" {
  interface GlyphPath {
    toPathData(decimals: number): string;
  }
  interface Font {
    getAdvanceWidth(text: string, fontSize: number): number;
    getPath(text: string, x: number, y: number, fontSize: number): GlyphPath;
  }
  interface OpenType {
    parse(buffer: ArrayBuffer): Font;
  }
  const opentype: OpenType;
  export default opentype;
}
