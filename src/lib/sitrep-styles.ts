// Print stylesheet for the standalone SITREP HTML. Kept in its own module so the
// renderer in sitrep.ts stays focused on structure. A government report is a
// light document: the colour-scheme/background pins below stop an OS/UA dark mode
// from painting a black canvas behind the near-black body text (which would
// render the report invisible on screen and in print-to-PDF).
export const SITREP_CSS = `
    html { color-scheme: light; background: #ffffff; }
    body { font: 14px/1.5 -apple-system, system-ui, sans-serif; color: #18181b; background: #ffffff; max-width: 820px; margin: 32px auto; padding: 0 24px; }
    h1 { font-size: 22px; margin: 0 0 4px; }
    h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.08em; margin-top: 28px; border-bottom: 1px solid #d4d4d8; padding-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { text-align: left; padding: 4px 6px; border-bottom: 1px solid #e4e4e7; font-size: 12px; }
    .pill { display: inline-block; padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 12px; }
    .pill.GREEN { background: #dcfce7; color: #166534; }
    .pill.AMBER { background: #fef3c7; color: #92400e; }
    .pill.RED { background: #fee2e2; color: #991b1b; }
    .pill.BLACK { background: #0f172a; color: #ffffff; }
    .pill.DEMO { background: #ede9fe; color: #5b21b6; font-size: 10px; padding: 1px 6px; }
    ul { padding-left: 18px; }
    p { margin: 0 0 10px; }
    .badge { display:inline-block; padding:3px 10px; border-radius:4px; font-weight:600; font-size:12px; }
    figure { margin: 14px 0; }
    figure svg { max-width: 100%; height: auto; }
    figcaption { font-size: 11px; color: #52525b; margin-top: 6px; text-align: left; }
    .tcaption { font-size: 11px; color: #52525b; margin: 12px 0 0; }
    .classification { text-align:center; font-size:11px; font-weight:700; letter-spacing:0.1em; color:#52525b; text-transform:uppercase; padding:6px 0; border-top:1px solid #d4d4d8; border-bottom:1px solid #d4d4d8; }
    .titleblock { margin-top:20px; }
    .titleblock .subtitle { font-size:13px; color:#52525b; margin-top:2px; }
    .titleblock h1 { margin-bottom:2px; }
    table.meta { margin-top:14px; }
    table.meta td { font-size:12px; border-bottom:1px solid #f1f1f3; padding:5px 8px; }
    table.meta td:first-child { width:160px; color:#52525b; font-weight:600; }
    .bottomline { border:1px solid #e4e4e7; border-left:4px solid #f43f5e; border-radius:6px; padding:10px 14px; background:#fafafa; margin-top:8px; }
    .appendix { margin-top:36px; border-top:2px solid #d4d4d8; padding-top:10px; }
    .appendix h2 { border:0; }
    .appendix table { max-width:360px; }
    .muted { color:#71717a; font-size:11px; }
`;
