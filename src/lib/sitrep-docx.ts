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
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import type { SitrepModel } from "./types";
import type { SitrepVisuals } from "./sitrep";
import { kpiBandSvg, riskMatrixSvg, trendChartSvg, provincialMapSvg } from "./sitrep-visuals";
import { svgToPng } from "./sitrep-raster";
import { provincialRiskCaption, STRATEGIC_INTRO } from "./sitrep-shared";

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

// Rasterize one SVG and wrap it as a full-width Word image. width/height are the
// on-page points; the PNG is rendered at 2× for print crispness.
async function svgFigure(svg: string, ptW: number, ptH: number): Promise<Paragraph> {
  const png = await svgToPng(svg, ptW * 2);
  return new Paragraph({
    spacing: { before: 80, after: 80 },
    children: [
      new ImageRun({
        data: png,
        transformation: { width: ptW, height: ptH },
        type: "png",
      }),
    ],
  });
}

export async function buildSitrepDocx(m: SitrepModel, v: SitrepVisuals): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [];

  // Rasterize SVG visuals at 2× for print crispness.
  const kpiFig = await svgFigure(kpiBandSvg(v.national), 600, 130);
  const matrixFig = await svgFigure(riskMatrixSvg(v.sectorRisk), 600, 280);
  const mapFig = await svgFigure(provincialMapSvg(v.geojson, v.sectorRisk), 470, 380);
  const trendsFig = await svgFigure(trendChartSvg(v.history, v.indicators ?? []), 600, 200);

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

  // Confidence line (exec-first: immediately after title).
  children.push(
    new Paragraph({
      spacing: { after: 120 },
      children: [
        new TextRun({ text: `Data confidence: ${m.confidence.level}. `, bold: true, size: 18 }),
        new TextRun({ text: m.confidence.line, size: 18, color: "52525B" }),
      ],
    }),
  );

  // Executive overview — KPI band visual.
  children.push(sectionHeading("Executive overview"), kpiFig);

  // Bottom line.
  children.push(
    sectionHeading("Bottom line"),
    new Paragraph({ children: [new TextRun({ text: m.bottomLine || "No national status this cycle.", size: 20 })] }),
  );

  // Summary.
  children.push(
    sectionHeading("Summary"),
    new Paragraph({ children: [new TextRun({ text: m.summary, size: 20 })] }),
  );

  // National risk matrix.
  children.push(sectionHeading("National risk matrix"), matrixFig);

  // Provincial risk map.
  children.push(sectionHeading("Provincial risk map"), mapFig);

  // Provincial risk table.
  children.push(
    sectionHeading("Provincial risk"),
    new Paragraph({
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: provincialRiskCaption(m.provinceCount, m.provincesAtRisk),
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

  // Indicator trends figure then key indicators table.
  children.push(sectionHeading("Indicator trends"), trendsFig);
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

  // Strategic context (WEF). Plain-language framing first, then one block per
  // insight: bold headline + scope/DEMO, the paraphrase, a "why it matters here"
  // line, and the public source. Mirrors the HTML report's Strategic context
  // cards so the Word document and the on-screen report stay in lockstep.
  if (m.strategic.length) {
    children.push(
      sectionHeading("Strategic context · World Economic Forum"),
      new Paragraph({
        spacing: { after: 140 },
        children: [new TextRun({ text: STRATEGIC_INTRO, size: 18, color: "52525B" })],
      }),
    );
    for (const s of m.strategic) {
      children.push(
        new Paragraph({
          spacing: { before: 120, after: 20 },
          children: [
            new TextRun({ text: s.title, bold: true, size: 20 }),
            new TextRun({ text: `   ${s.scope} · ${s.provenance}`, size: 16, color: "71717A" }),
          ],
        }),
        new Paragraph({
          spacing: { after: 20 },
          children: [new TextRun({ text: s.summary, size: 20 })],
        }),
        new Paragraph({
          spacing: { after: 20 },
          children: [
            new TextRun({ text: "Why it matters here: ", bold: true, size: 20 }),
            new TextRun({ text: s.relevance, size: 20 }),
          ],
        }),
        new Paragraph({
          spacing: { after: 60 },
          children: [
            new TextRun({ text: `${s.source} · ${s.published} · ${s.url}`, size: 16, color: "71717A" }),
          ],
        }),
      );
    }
  }

  // Analyst note (free text — editable; this is the section executives most want
  // to refine in Word).
  if (m.analystNote) {
    children.push(
      sectionHeading("Analyst note"),
      new Paragraph({ children: [new TextRun({ text: m.analystNote, size: 20 })] }),
    );
  }

  // Technical appendix — replaces the old "Data sources this cycle" footer.
  children.push(
    new Paragraph({
      spacing: { before: 320 },
      border: { top: BORDER },
      heading: HeadingLevel.HEADING_2,
      children: [new TextRun({ text: "TECHNICAL APPENDIX", bold: true, size: 20 })],
    }),
    new Paragraph({
      spacing: { after: 80 },
      children: [new TextRun({ text: `For data and operations staff. ${m.confidence.line}`, size: 16, color: "71717A" })],
    }),
  );
  const feedHead = new TableRow({
    tableHeader: true,
    children: [headerCell("Data feed"), headerCell("Status this cycle")],
  });
  const feedRows = m.confidence.feeds.length
    ? m.confidence.feeds.map((f) => new TableRow({ children: [cell(f.name), cell(f.ok ? "OK" : "FAIL", { bold: true })] }))
    : [new TableRow({ children: [cell("No ingest run reported this cycle.")] })];
  children.push(fullWidthTable([feedHead, ...feedRows]));
  children.push(
    new Paragraph({
      spacing: { before: 80 },
      children: [
        new TextRun({
          text: "NEWCIS proof-of-concept · newcis.in4metrix.dev · Generated from a point-in-time data snapshot. Figures marked DEMO are seeded references, not live feeds.",
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
