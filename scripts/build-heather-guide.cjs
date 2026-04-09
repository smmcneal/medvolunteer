'use strict';
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, LevelFormat, BorderStyle, WidthType, ShadingType,
  HeadingLevel, ExternalHyperlink,
} = require('docx');
const fs = require('fs');
const path = require('path');

// ── helpers ──────────────────────────────────────────────────────────────────

const NAVY  = '1B2A4A';
const TEAL  = '00897B';
const LIGHT = 'E8F5E9';
const GRAY  = 'F5F5F5';
const WHITE = 'FFFFFF';

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 320, after: 160 },
    children: [new TextRun({ text, font: 'Arial', size: 36, bold: true, color: NAVY })],
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 120 },
    children: [new TextRun({ text, font: 'Arial', size: 28, bold: true, color: NAVY })],
  });
}

function body(text, opts = {}) {
  return new Paragraph({
    spacing: { before: 80, after: 80 },
    children: [new TextRun({ text, font: 'Arial', size: 22, ...opts })],
  });
}

function gap() {
  return new Paragraph({ spacing: { before: 80, after: 80 }, children: [new TextRun('')] });
}

function numberedStep(num, label, detail) {
  const border = { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' };
  const borders = { top: border, bottom: border, left: border, right: border };

  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [720, 8640],
    margins: { top: 80, bottom: 80 },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders,
            width: { size: 720, type: WidthType.DXA },
            shading: { fill: NAVY, type: ShadingType.CLEAR },
            margins: { top: 120, bottom: 120, left: 120, right: 120 },
            verticalAlign: 'center',
            children: [new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: String(num), font: 'Arial', size: 24, bold: true, color: WHITE })],
            })],
          }),
          new TableCell({
            borders,
            width: { size: 8640, type: WidthType.DXA },
            shading: { fill: GRAY, type: ShadingType.CLEAR },
            margins: { top: 120, bottom: 120, left: 200, right: 120 },
            children: [
              new Paragraph({
                children: [new TextRun({ text: label, font: 'Arial', size: 24, bold: true, color: NAVY })],
              }),
              ...(detail ? [new Paragraph({
                spacing: { before: 60 },
                children: [new TextRun({ text: detail, font: 'Arial', size: 20, color: '444444' })],
              })] : []),
            ],
          }),
        ],
      }),
    ],
  });
}

function callout(text, emoji) {
  const border = { style: BorderStyle.SINGLE, size: 1, color: TEAL };
  const borders = { top: border, bottom: border, left: border, right: border };
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [480, 8880],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders,
            width: { size: 480, type: WidthType.DXA },
            shading: { fill: LIGHT, type: ShadingType.CLEAR },
            margins: { top: 120, bottom: 120, left: 120, right: 80 },
            children: [new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: emoji, font: 'Arial', size: 24 })],
            })],
          }),
          new TableCell({
            borders,
            width: { size: 8880, type: WidthType.DXA },
            shading: { fill: LIGHT, type: ShadingType.CLEAR },
            margins: { top: 120, bottom: 120, left: 120, right: 120 },
            children: [new Paragraph({
              children: [new TextRun({ text, font: 'Arial', size: 20, color: '1A5E20' })],
            })],
          }),
        ],
      }),
    ],
  });
}

function sectionDivider(label) {
  return new Paragraph({
    spacing: { before: 400, after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: TEAL, space: 4 } },
    children: [new TextRun({ text: label.toUpperCase(), font: 'Arial', size: 18, bold: true, color: TEAL })],
  });
}

function linkPara(label, url) {
  return new Paragraph({
    spacing: { before: 60, after: 60 },
    children: [
      new TextRun({ text: label + ': ', font: 'Arial', size: 22, bold: true }),
      new ExternalHyperlink({
        link: url,
        children: [new TextRun({ text: url, font: 'Arial', size: 22, style: 'Hyperlink' })],
      }),
    ],
  });
}

// ── document ─────────────────────────────────────────────────────────────────

const doc = new Document({
  numbering: {
    config: [
      {
        reference: 'bullets',
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: '-',
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 560, hanging: 280 } } },
        }],
      },
    ],
  },
  styles: {
    default: { document: { run: { font: 'Arial', size: 22 } } },
    paragraphStyles: [
      {
        id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 36, bold: true, font: 'Arial', color: NAVY },
        paragraph: { spacing: { before: 320, after: 160 }, outlineLevel: 0 },
      },
      {
        id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 28, bold: true, font: 'Arial', color: NAVY },
        paragraph: { spacing: { before: 280, after: 120 }, outlineLevel: 1 },
      },
    ],
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
      },
    },
    children: [

      // ── Title block ────────────────────────────────────────────────────────
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 240, after: 80 },
        children: [new TextRun({ text: 'MedVolunteer Automation Setup', font: 'Arial', size: 44, bold: true, color: NAVY })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 80 },
        children: [new TextRun({ text: 'Step: Connect Notion to GitHub & Vercel', font: 'Arial', size: 26, color: '555555' })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 400 },
        children: [new TextRun({ text: 'For: Heather  |  Time needed: ~10 minutes', font: 'Arial', size: 22, italics: true, color: '777777' })],
      }),

      // ── What this does ────────────────────────────────────────────────────
      sectionDivider('What this does'),
      gap(),
      body('Once you complete these steps, the Dev Tasks & QA board in Notion will update automatically:'),
      gap(),

      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [3120, 6240],
        rows: [
          new TableRow({
            tableHeader: true,
            children: [
              new TableCell({
                borders: { bottom: { style: BorderStyle.SINGLE, size: 4, color: NAVY } },
                shading: { fill: NAVY, type: ShadingType.CLEAR },
                margins: { top: 100, bottom: 100, left: 120, right: 120 },
                width: { size: 3120, type: WidthType.DXA },
                children: [new Paragraph({ children: [new TextRun({ text: 'When this happens', font: 'Arial', size: 22, bold: true, color: WHITE })] })],
              }),
              new TableCell({
                borders: { bottom: { style: BorderStyle.SINGLE, size: 4, color: NAVY } },
                shading: { fill: NAVY, type: ShadingType.CLEAR },
                margins: { top: 100, bottom: 100, left: 120, right: 120 },
                width: { size: 6240, type: WidthType.DXA },
                children: [new Paragraph({ children: [new TextRun({ text: 'Notion updates automatically', font: 'Arial', size: 22, bold: true, color: WHITE })] })],
              }),
            ],
          }),
          ...([
            ['Sean opens a Pull Request',       'Task status \u2192 Code Review + PR link saved'],
            ['Pull Request is merged',           'Task status \u2192 Done'],
            ['Code is deployed to Vercel',       'Task status \u2192 Testing + preview URL saved'],
            ['Sean commits code (in Claude)',     'Task status \u2192 In Progress'],
            ['Migration files merged to main',   'Database migrations auto-applied to Supabase'],
          ].map(([when, what], i) =>
            new TableRow({
              children: [
                new TableCell({
                  borders: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' } },
                  shading: { fill: i % 2 === 0 ? GRAY : WHITE, type: ShadingType.CLEAR },
                  margins: { top: 100, bottom: 100, left: 120, right: 120 },
                  width: { size: 3120, type: WidthType.DXA },
                  children: [new Paragraph({ children: [new TextRun({ text: when, font: 'Arial', size: 20 })] })],
                }),
                new TableCell({
                  borders: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' } },
                  shading: { fill: i % 2 === 0 ? GRAY : WHITE, type: ShadingType.CLEAR },
                  margins: { top: 100, bottom: 100, left: 120, right: 120 },
                  width: { size: 6240, type: WidthType.DXA },
                  children: [new Paragraph({ children: [new TextRun({ text: what, font: 'Arial', size: 20 })] })],
                }),
              ],
            })
          )),
        ],
      }),

      gap(),
      gap(),

      // ── Part 1: Create the integration ───────────────────────────────────
      sectionDivider('Part 1 of 2 \u2014 Create a Notion integration'),
      gap(),
      body('This gives our automation a secure key to read and update the Dev Tasks database.'),
      gap(),

      numberedStep(1, 'Go to notion.so/my-integrations', 'Make sure you are logged in as yourself in the Cottage 8 Consulting workspace.'),
      gap(),
      numberedStep(2, 'Click the \u201cNew integration\u201d button', null),
      gap(),
      numberedStep(3, 'Fill in the form', null),
      gap(),

      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [2880, 6480],
        rows: [
          new TableRow({
            children: [
              new TableCell({
                borders: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' } },
                shading: { fill: NAVY, type: ShadingType.CLEAR },
                margins: { top: 100, bottom: 100, left: 120, right: 120 },
                width: { size: 2880, type: WidthType.DXA },
                children: [new Paragraph({ children: [new TextRun({ text: 'Field', font: 'Arial', size: 20, bold: true, color: WHITE })] })],
              }),
              new TableCell({
                borders: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' } },
                shading: { fill: NAVY, type: ShadingType.CLEAR },
                margins: { top: 100, bottom: 100, left: 120, right: 120 },
                width: { size: 6480, type: WidthType.DXA },
                children: [new Paragraph({ children: [new TextRun({ text: 'What to enter', font: 'Arial', size: 20, bold: true, color: WHITE })] })],
              }),
            ],
          }),
          ...([
            ['Integration name',    'MedVolunteer Automation'],
            ['Associated workspace', 'Cottage 8 Consulting  \u2190 IMPORTANT: must be this one'],
            ['Icon',                '(optional \u2014 skip it)'],
          ].map(([field, value], i) =>
            new TableRow({
              children: [
                new TableCell({
                  borders: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' } },
                  shading: { fill: i % 2 === 0 ? GRAY : WHITE, type: ShadingType.CLEAR },
                  margins: { top: 80, bottom: 80, left: 120, right: 120 },
                  width: { size: 2880, type: WidthType.DXA },
                  children: [new Paragraph({ children: [new TextRun({ text: field, font: 'Arial', size: 20, bold: true })] })],
                }),
                new TableCell({
                  borders: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' } },
                  shading: { fill: i % 2 === 0 ? GRAY : WHITE, type: ShadingType.CLEAR },
                  margins: { top: 80, bottom: 80, left: 120, right: 120 },
                  width: { size: 6480, type: WidthType.DXA },
                  children: [new Paragraph({ children: [new TextRun({ text: value, font: 'Arial', size: 20 })] })],
                }),
              ],
            })
          )),
        ],
      }),

      gap(),
      numberedStep(4, 'Click \u201cCreate\u201d', null),
      gap(),
      numberedStep(5, 'Copy the Internal Integration Secret', 'It starts with secret_  and is a long string of letters and numbers. Copy the whole thing.'),
      gap(),

      callout('Send Sean the token via a private message or email \u2014 do not paste it in Slack, Notion, or a shared doc. It is a password.', 'KEY'),

      gap(),
      gap(),
      linkPara('Link', 'https://www.notion.so/my-integrations'),
      gap(),
      gap(),

      // ── Part 2: Connect the database ─────────────────────────────────────
      sectionDivider('Part 2 of 2 \u2014 Connect the integration to the Dev Tasks database'),
      gap(),
      body('The token exists but has no access to anything yet. This step tells Notion which database it can touch.'),
      gap(),

      numberedStep(1, 'Open the Dev Tasks & QA database in Notion', 'The one with DEV-001, DEV-002, DEV-003.'),
      gap(),
      numberedStep(2, 'Click the \u2026 menu in the top-right corner of the page', null),
      gap(),
      numberedStep(3, 'Click \u201cConnections\u201d', null),
      gap(),
      numberedStep(4, 'Search for \u201cMedVolunteer Automation\u201d and click \u201cConnect\u201d', 'If you do not see it, make sure you created the integration in the Cottage 8 Consulting workspace (Part 1, Step 3).'),
      gap(),
      numberedStep(5, 'Confirm the connection when prompted', null),
      gap(),

      callout('That\'s it! Once Sean receives the token and adds it to GitHub, the automation is live. No more manual status updates.', 'CHECK'),

      gap(),
      gap(),

      // ── What to send Sean ─────────────────────────────────────────────────
      sectionDivider('What to send Sean when done'),
      gap(),
      body('Send Sean a private message with:'),
      gap(),

      new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        spacing: { before: 60, after: 60 },
        children: [new TextRun({ text: 'The integration token (starts with secret_)', font: 'Arial', size: 22 })],
      }),
      new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        spacing: { before: 60, after: 60 },
        children: [new TextRun({ text: 'Confirmation that you connected it to Dev Tasks & QA', font: 'Arial', size: 22 })],
      }),
      new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        spacing: { before: 60, after: 60 },
        children: [new TextRun({ text: 'The database URL from your browser (so Sean can extract the database ID)', font: 'Arial', size: 22 })],
      }),

      gap(),
      gap(),
      body('The database URL looks like:', { color: '555555' }),
      gap(),
      body('https://www.notion.so/cottage8consulting/Dev-Tasks-QA-XXXXXXXXXXXXXXXX?v=...', { font: 'Courier New', size: 18, color: TEAL }),
      gap(),
      body('The part after the last \u2014 and before the ? is the database ID Sean needs.', { color: '555555', italics: true }),
      gap(),

      // ── Footer note ───────────────────────────────────────────────────────
      gap(),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        border: { top: { style: BorderStyle.SINGLE, size: 2, color: 'DDDDDD', space: 8 } },
        spacing: { before: 400, after: 0 },
        children: [new TextRun({ text: 'Questions? Ask Sean \u2014 he has Claude Code set up and can troubleshoot any step.', font: 'Arial', size: 18, italics: true, color: '888888' })],
      }),
    ],
  }],
});

Packer.toBuffer(doc).then(buf => {
  const out = path.join(__dirname, '..', 'Heather_Notion_Setup_Guide.docx');
  fs.writeFileSync(out, buf);
  console.log('Written:', out);
});
