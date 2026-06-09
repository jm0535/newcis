// Editable .docx export of a Weekly SITREP. Built from the SAME SitrepModel that
// backs the HTML view (src/lib/sitrep.ts → renderSitrepHtml), so the Word document
// and the on-screen/print report can never drift.
//
// Why a real .docx (the `docx` library) and not HTML-to-Word: executives open this
// in Word to edit and re-share. A genuine Office Open XML document gives them real
// headings, styled tables and editable text — not a brittle HTML import that loses
// structure the moment they touch it.
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import type { SitrepModel } from "./types";

// AlignmentType is a value object, not a type — alias its value union for params.
type Align = (typeof AlignmentType)[keyof typeof AlignmentType];

// Traffic-light fills for the worst-level cell, matching the HTML report's pills.
const LEVEL_FILL: Record<string, { fill: string; color: string }> = {
  LOW: { fill: "DCFCE7", color: "166534" },
  MED: { fill: "FEF3C7", color: "92400E" },
  HIGH: { fill: "FEE2E2", color: "991B1B" },
  CRITICAL: { fill: "0F172A", color: "FFFFFF" },
};

const HEADER_FILL = "F4F4F5";
const BORDER = { style: BorderStyle.SINGLE, size: 4, color: "E4E4E7" };
const CELL_BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };

function headerCell(text: string, align: Align = AlignmentType.LEFT): TableCell {
  return new TableCell({
    shading: { fill: HEADER_FILL },
    borders: CELL_BORDERS,
    children: [
      new Paragraph({
        alignment: align,
        children: [new TextRun({ text, bold: true, size: 18 })],
      }),
    ],
  });
}

function cell(
  text: string,
  opts: { align?: Align; fill?: string; color?: string; bold?: boolean } = {},
): TableCell {
  return new TableCell({
    shading: opts.fill ? { fill: opts.fill } : undefined,
    borders: CELL_BORDERS,
    children: [
      new Paragraph({
        alignment: opts.align ?? AlignmentType.LEFT,
        children: [
          new TextRun({ text, size: 18, bold: opts.bold, color: opts.color }),
        ],
      }),
    ],
  });
}

function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 120 },
    children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 20 })],
  });
}

function bullet(text: string): Paragraph {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 40 },
    children: [new TextRun({ text, size: 20 })],
  });
}

function fullWidthTable(rows: TableRow[]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows,
  });
}

export async function buildSitrepDocx(m: SitrepModel): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [];

  // Title block.
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 60 },
      children: [
        new TextRun({ text: "NEWCIS · Weekly ENSO Situation Report", bold: true, size: 32 }),
      ],
    }),
    new Paragraph({
      spacing: { after: 40 },
      children: [
        new TextRun({ text: "Period: ", size: 20 }),
        new TextRun({ text: m.period, bold: true, size: 20 }),
        new TextRun({ text: "  ·  Generated ", size: 20 }),
        new TextRun({ text: m.generatedAt, bold: true, size: 20 }),
      ],
    }),
    new Paragraph({
      spacing: { after: 120 },
      children: [
        new TextRun({ text: m.alert, bold: true, size: 22 }),
        new TextRun({ text: `   ${m.enso}   ·   National risk: `, size: 20 }),
        new TextRun({ text: m.rating, bold: true, size: 20 }),
      ],
    }),
  );

  // Summary.
  children.push(
    sectionHeading("Summary"),
    new Paragraph({ children: [new TextRun({ text: m.summary, size: 20 })] }),
  );

  // Key indicators.
  children.push(sectionHeading("Key indicators"));
  if (m.indicators.length) {
    const head = new TableRow({
      tableHeader: true,
      children: [
        headerCell("Key"),
        headerCell("Label"),
        headerCell("Value", AlignmentType.RIGHT),
        headerCell("Unit"),
        headerCell("Source"),
        headerCell("Observed"),
      ],
    });
    const rows = m.indicators.map(
      (i) =>
        new TableRow({
          children: [
            cell(i.key),
            cell(i.label),
            cell(i.value, { align: AlignmentType.RIGHT }),
            cell(i.unit),
            cell(i.provenance),
            cell(i.observedAt),
          ],
        }),
    );
    children.push(fullWidthTable([head, ...rows]));
  } else {
    children.push(new Paragraph({ children: [new TextRun({ text: "No indicators available.", size: 20 })] }));
  }

  // Provincial risk.
  children.push(
    sectionHeading("Provincial risk"),
    new Paragraph({
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: `All ${m.provinceCount} provinces ranked worst-first by their single most-stressed sector. ${m.provincesAtRisk} of ${m.provinceCount} sit at HIGH or CRITICAL. "Stressed" counts how many of a province's sectors are at HIGH or CRITICAL.`,
          size: 18,
          color: "52525B",
        }),
      ],
    }),
  );
  if (m.provinces.length) {
    const head = new TableRow({
      tableHeader: true,
      children: [
        headerCell("#", AlignmentType.RIGHT),
        headerCell("Province"),
        headerCell("Worst level"),
        headerCell("Worst sector"),
        headerCell("Stressed", AlignmentType.RIGHT),
      ],
    });
    const rows = m.provinces.map((p) => {
      const pill = LEVEL_FILL[p.level];
      return new TableRow({
        children: [
          cell(String(p.rank), { align: AlignmentType.RIGHT }),
          cell(`${p.name} (${p.code})`),
          pill
            ? cell(p.level, { fill: pill.fill, color: pill.color, bold: true })
            : cell(p.level),
          cell(p.sector),
          cell(String(p.stressed || 0), { align: AlignmentType.RIGHT }),
        ],
      });
    });
    children.push(fullWidthTable([head, ...rows]));
  } else {
    children.push(
      new Paragraph({ children: [new TextRun({ text: "No focus-province sector cells available.", size: 20 })] }),
    );
  }

  // Focus province · sector movers.
  children.push(sectionHeading("Focus province · sector movers"));
  if (m.movers.length) {
    for (const mv of m.movers) children.push(bullet(mv));
  } else {
    children.push(bullet("No focus-province sector cells available."));
  }

  // Recommended actions.
  children.push(sectionHeading("Recommended actions"));
  if (m.actions.length) {
    for (const a of m.actions) children.push(bullet(a));
  } else {
    children.push(bullet("—"));
  }

  // Analyst note (free text — editable; this is the section executives most want
  // to refine in Word).
  if (m.analystNote) {
    children.push(
      sectionHeading("Analyst note"),
      new Paragraph({ children: [new TextRun({ text: m.analystNote, size: 20 })] }),
    );
  }

  // Footer — data sources this cycle.
  const sourceLine = m.sources.length
    ? m.sources.map((s) => `${s.name}: ${s.ok ? "OK" : "FAIL"}`).join("  ·  ")
    : "—";
  children.push(
    new Paragraph({
      spacing: { before: 320 },
      border: { top: BORDER },
      children: [
        new TextRun({
          text: `Data sources this cycle: ${sourceLine}.`,
          size: 16,
          color: "71717A",
        }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: "NEWCIS proof-of-concept · newcis.in4metrix.dev · Generated from a point-in-time data snapshot.",
          size: 16,
          color: "71717A",
        }),
      ],
    }),
  );

  const doc = new Document({
    creator: "NEWCIS",
    title: m.docTitle,
    description: "NEWCIS Weekly ENSO Situation Report",
    sections: [{ children }],
  });

  return Packer.toBuffer(doc);
}
