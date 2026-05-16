/**
 * Constante print-friendly partajate intre toate generatoarele PDF
 * (deviz, factura, chitanta, cazare, montaj roti, receipt POS, etc).
 *
 * Pentru a schimba paleta de culori in tot stack-ul de PDF-uri modifica aici.
 */

type RGB = readonly [number, number, number];

export const COLORS = {
  black:     [20, 20, 20]      as RGB,
  gray:      [100, 100, 100]   as RGB,
  lightGray: [180, 180, 180]   as RGB,
  veryLight: [240, 240, 240]   as RGB,  // header tabel
  white:     [255, 255, 255]   as RGB,
} as const;

// Margini si dimensiuni A4 portrait, in mm.
export const PAGE = {
  width:  210,
  height: 297,
  marginLeft:   15,
  marginRight:  15,
  marginTop:    14,
} as const;

/** Latimea utila intre marginile stanga si dreapta. */
export const CONTENT_WIDTH = PAGE.width - PAGE.marginLeft - PAGE.marginRight;
