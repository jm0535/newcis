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
import {
  provincialRiskCaption,
  RISK_MATRIX_CAPTION,
  STRATEGIC_INTRO,
} from "./sitrep-shared";
import {
  CLASSIFICATION,
  DISTRIBUTION,
  ISSUING_AUTHORITY,
  actionsLeadParas,
  climateAssessmentParas,
  conclusionParas,
  executiveSummary,
  introductionParas,
  provincialAssessmentParas,
  sectoralImpactParas,
  situationOverviewParas,
} from "./sitrep-prose";

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
    spacing: { before: 80, after: 40 },
    children: [
      new ImageRun({
        data: png,
        transformation: { width: ptW, height: ptH },
        type: "png",
      }),
    ],
  });
}

// A body prose paragraph — the narrative that wraps the exhibits.
function bodyPara(text: string): Paragraph {
  return new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text, size: 20 })],
  });
}

// A numbered figure/table caption: bold "Figure N." / "Table N." then the text.
function caption(label: string, text: string): Paragraph {
  return new Paragraph({
    spacing: { after: 120 },
    children: [
      new TextRun({ text: `${label} `, bold: true, size: 16, color: "52525B" }),
      new TextRun({ text, size: 16, color: "52525B" }),
    ],
  });
}

// The centred classification banner top and bottom of the document.
function classificationBanner(): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 60, after: 60 },
    border: {
      top: { style: BorderStyle.SINGLE, size: 4, color: "D4D4D8" },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: "D4D4D8" },
    },
    children: [new TextRun({ text: CLASSIFICATION, bold: true, size: 16, color: "52525B" })],
  });
}

// One row of the title-block metadata table (label | value).
function metaRow(label: string, value: string, bold = false): TableRow {
  return new TableRow({
    children: [
      new TableCell({
        borders: CELL_BORDERS,
        shading: { fill: HEADER_FILL },
        children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 16, color: "52525B" })] })],
      }),
      new TableCell({
        borders: CELL_BORDERS,
        children: [new Paragraph({ children: [new TextRun({ text: value, bold, size: 18 })] })],
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

  // Figure/table numbering. A government report cross-references its exhibits, so
  // each visual and data table carries a sequential, captioned label in document
  // order.
  let figNo = 0;
  let tblNo = 0;
  const figLabel = () => `Figure ${++figNo}.`;
  const tblLabel = () => `Table ${++tblNo}.`;

  // Classification banner + title block.
  children.push(
    classificationBanner(),
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 120, after: 20 },
      children: [new TextRun({ text: "Weekly ENSO Situation Report", bold: true, size: 32 })],
    }),
    new Paragraph({
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: "National ENSO Early Warning & Climate Intelligence System (NEWCIS)",
          size: 20,
          color: "52525B",
        }),
      ],
    }),
  );
  children.push(
    fullWidthTable([
      metaRow("Issuing authority", ISSUING_AUTHORITY),
      metaRow("Reporting period", m.period, true),
      metaRow("Report reference", m.id),
      metaRow("Date generated", m.generatedAt),
      metaRow("Alert level", `${m.alert} · ${m.enso} · national risk ${m.rating}`, true),
      metaRow("Distribution", DISTRIBUTION),
      metaRow("Data confidence", m.confidence.level, true),
    ]),
  );

  // Executive summary — the BLUF.
  children.push(sectionHeading("Executive summary"), bodyPara(executiveSummary(m)));

  // 1 · Introduction.
  children.push(sectionHeading("1 · Introduction"));
  for (const p of introductionParas(m)) children.push(bodyPara(p));

  // 2 · Situation overview — KPI band.
  children.push(
    sectionHeading("2 · Situation overview"),
    ...situationOverviewParas(m).map(bodyPara),
    kpiFig,
    caption(
      figLabel(),
      "National key indicators — ENSO phase, alert level, risk rating, affected population, high-risk provinces and forecast period.",
    ),
  );

  // 3 · Climate & ENSO assessment — trends figure then indicator table.
  children.push(
    sectionHeading("3 · Climate & ENSO assessment"),
    ...climateAssessmentParas(m).map(bodyPara),
    trendsFig,
    caption(figLabel(), "Recent trend per climate indicator, with the latest value and unit on each chart."),
    caption(
      tblLabel(),
      "Climate indicators this cycle, with value, unit, provenance (LIVE/DEMO) and observation date.",
    ),
  );
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

  // 4 · Provincial risk assessment — map + matrix figures, then ranked table.
  children.push(
    sectionHeading("4 · Provincial risk assessment"),
    ...provincialAssessmentParas(m).map(bodyPara),
    mapFig,
    caption(figLabel(), "Provincial risk map — each province coloured by its single worst-hit sector."),
    matrixFig,
    caption(
      figLabel(),
      RISK_MATRIX_CAPTION,
    ),
    caption(tblLabel(), provincialRiskCaption(m.provinceCount, m.provincesAtRisk)),
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

  // 5 · Sectoral impact — prose then the sector-mover bullets.
  children.push(sectionHeading("5 · Sectoral impact"), ...sectoralImpactParas(m).map(bodyPara));
  if (m.movers.length) {
    for (const mv of m.movers) children.push(bullet(mv));
  } else {
    children.push(bullet("No focus-province sector cells available."));
  }

  // 6 · Strategic context (WEF). Plain-language framing first, then one block per
  // insight: bold headline + scope/DEMO, the paraphrase, a "why it matters here"
  // line, and the public source. Mirrors the HTML report's Strategic context
  // cards so the Word document and the on-screen report stay in lockstep.
  if (m.strategic.length) {
    children.push(
      sectionHeading("6 · Strategic context · World Economic Forum"),
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

  // 7 · Recommended actions — prose lead-in then the action bullets.
  children.push(sectionHeading("7 · Recommended actions"), ...actionsLeadParas(m).map(bodyPara));
  if (m.actions.length) {
    for (const a of m.actions) children.push(bullet(a));
  } else {
    children.push(bullet("—"));
  }

  // 8 · Conclusion.
  children.push(sectionHeading("8 · Conclusion"), ...conclusionParas(m).map(bodyPara));

  // 9 · Analyst note (free text — editable; this is the section executives most
  // want to refine in Word).
  if (m.analystNote) {
    children.push(
      sectionHeading("9 · Analyst note"),
      new Paragraph({ children: [new TextRun({ text: m.analystNote, size: 20 })] }),
    );
  }

  // Annex A · Technical appendix — replaces the old "Data sources this cycle" footer.
  children.push(
    new Paragraph({
      spacing: { before: 320 },
      border: { top: BORDER },
      heading: HeadingLevel.HEADING_2,
      children: [new TextRun({ text: "ANNEX A · TECHNICAL APPENDIX", bold: true, size: 20 })],
    }),
    new Paragraph({
      spacing: { after: 80 },
      children: [new TextRun({ text: `For data and operations staff. ${m.confidence.line}`, size: 16, color: "71717A" })],
    }),
    caption(tblLabel(), "Status of each data feed for this ingest cycle."),
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
    classificationBanner(),
  );

  const doc = new Document({
    creator: "NEWCIS",
    title: m.docTitle,
    description: "NEWCIS Weekly ENSO Situation Report",
    sections: [{ children }],
  });

  return Packer.toBuffer(doc);
}
