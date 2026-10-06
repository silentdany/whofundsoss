declare module "opentype.js/dist/opentype.mjs" {
  interface GlyphPath {
    toPathData(decimals: number): string;
  }
  interface Font {
    getAdvanceWidth(text: string, fontSize: number): number;
    getPath(text: string, x: number, y: number, fontSize: number): GlyphPath;
  }
  export function parse(buffer: ArrayBuffer): Font;
}
