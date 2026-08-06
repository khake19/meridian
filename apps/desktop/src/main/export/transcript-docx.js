const {
  AlignmentType,
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

function transcriptTagLabel(tagCode) {
  return tagCode.replaceAll('_', ' ').replace(/^./, (character) => character.toUpperCase());
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

async function createTranscriptDocx(project, exportedAt = new Date()) {
  const run = project.latestProcessingRun;
  const title = readableDocumentTitle(project);
  const metadata = [
    project.recording.originalFilename,
    run?.model ? `Model: ${run.model}` : null,
    run?.language ? `Language: ${run.language.toUpperCase()}` : null,
    `Exported: ${exportedAt.toLocaleString()}`,
  ].filter(Boolean).join('  •  ');

  const transcript = project.transcript || [];
  const children = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      children: [new TextRun({ text: title, bold: true })],
    }),
    new Paragraph({
      children: [new TextRun({ text: metadata, color: '666666', size: 18 })],
      spacing: { after: 360 },
    }),
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun('Transcript')],
      spacing: { after: 180 },
    }),
    ...transcript.flatMap((segment) => [
      new Paragraph({
        children: [
          new TextRun({ text: `${formatTimestamp(segment.startMs)}  `, color: '666666', size: 18 }),
          new TextRun({ text: speakerName(project, segment.speakerId), bold: true, size: 21 }),
        ],
        spacing: { before: 140, after: 60 },
      }),
      new Paragraph({
        children: [new TextRun({ text: segment.text || '', size: 21 })],
        spacing: { after: segment.tags?.length ? 50 : 120, line: 300 },
      }),
      ...(segment.tags?.length ? [new Paragraph({
        children: [new TextRun({
          text: `Tags: ${segment.tags.map(transcriptTagLabel).join(' • ')}`,
          color: '777777', italics: true, size: 17,
        })],
        spacing: { after: 120 },
      })] : []),
    ]),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'Generated locally by Meridian', color: '888888', size: 16 })],
      spacing: { before: 480 },
    }),
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

module.exports = { createTranscriptDocx, formatTimestamp, readableDocumentTitle, safeDocumentName, transcriptTagLabel };
