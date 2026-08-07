const {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} = require('docx');

function formatTimestamp(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function speakerName(project, speakerId) {
  return project.speakers?.find((speaker) => speaker.id === speakerId)?.displayName || 'Unassigned';
}

function blankFormLine(label, length = 42, spacingAfter = 90) {
  return new Paragraph({
    children: [
      new TextRun({ text: `${label}:  `, bold: true, size: 20 }),
      new TextRun({ text: '_'.repeat(length), size: 20 }),
    ],
    spacing: { after: spacingAfter },
  });
}

function readableDocumentTitle(project) {
  const source = project.project.title;
  const cleaned = source.replace(/\.[a-z0-9]+$/i, '').replace(/\d{5,}/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  const title = (cleaned || source).split(' ')
    .map((word) => word ? word.charAt(0).toUpperCase() + word.slice(1) : word).join(' ');
  const match = (project.recording.originalFilename || source).match(/(20\d{2})(\d{2})(\d{2})/);
  if (!match) return title;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (date.getFullYear() !== Number(match[1]) || date.getMonth() !== Number(match[2]) - 1 || date.getDate() !== Number(match[3])) return title;
  return `${title} — ${date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}`;
}

async function createTranscriptDocx(project) {
  const title = readableDocumentTitle(project);
  const transcript = project.transcript || [];
  const children = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      children: [new TextRun({ text: 'Minutes of the Admin Hearing', bold: true, size: 28 })],
      spacing: { after: 240 },
    }),
    blankFormLine('Pagdinig sa kaso ni', 46),
    blankFormLine('Sinasabing Paglabag', 45),
    blankFormLine('Petsa', 58),
    blankFormLine('Lugar', 58),
    blankFormLine('Mga Dumalo sa Pagdinig', 40),
    blankFormLine('Nagsagawa ng Imbestigasyon', 36),
    blankFormLine('Oras ng umpisa (Admin Hearing Proper)', 25, 300),
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun('Transcript')],
      spacing: { after: 180 },
    }),
    ...transcript.flatMap((segment) => [
      new Paragraph({
        children: [
          new TextRun({ text: `${formatTimestamp(segment.startMs)}  `, color: '666666', size: 18 }),
          new TextRun({ text: `${speakerName(project, segment.speakerId)}: `, bold: true, size: 21 }),
          new TextRun({ text: segment.text || '', size: 21 }),
        ],
        spacing: { before: 140, after: 120, line: 300 },
      }),
    ]),
    new Paragraph({
      children: [new TextRun({ text: '(Maaaring gamitin ang likod na bahagi kung hindi sapat ang espasyo)', italics: true, size: 18 })],
      spacing: { before: 360, after: 120 },
    }),
    blankFormLine('Oras natapos', 52, 180),
    new Paragraph({
      children: [new TextRun({
        text: 'Pinapatunayan ng pirma ko na ako ay dumalo sa pagdinig at ang lahat ng nakasaad dito ay sinabi ko at kusa kong ipinahayag.',
        size: 20,
      })],
      spacing: { after: 300, line: 300 },
    }),
    blankFormLine('Pangalan at lagda', 48),
    blankFormLine('Department', 54),
  ];

  return Packer.toBuffer(new Document({
    creator: 'Meridian',
    title,
    description: `Transcript of ${project.recording.originalFilename}`,
    sections: [{
      properties: {
        page: { margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 } },
      },
      children,
    }],
  }));
}

function safeDocumentName(title) {
  const name = title.replace(/[<>:"/\\|?*\u0000-\u001F]/g, ' ').replace(/\s+/g, ' ').trim();
  return `${name || 'Meridian transcript'}.docx`;
}

module.exports = { createTranscriptDocx, formatTimestamp, readableDocumentTitle, safeDocumentName };
