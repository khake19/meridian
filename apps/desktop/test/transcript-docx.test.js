const assert = require('node:assert/strict');
const test = require('node:test');
const {
  createTranscriptDocx,
  formatTimestamp,
  readableDocumentTitle,
  safeDocumentName,
} = require('../src/main/export/transcript-docx');

function projectFixture() {
  return {
    project: { title: '2026072016_00138guard07202026' },
    recording: { originalFilename: '2026072016_00138guard07202026.wav' },
    latestProcessingRun: { model: 'large-v3', language: 'tl' },
    speakers: [{ id: 'speaker', displayName: 'Guard' }],
    transcript: [{ startMs: 65000, speakerId: 'speaker', text: 'Sample transcript.', tags: ['key_statement'] }],
  };
}

test('generates a genuine docx transcript package', async () => {
  const buffer = await createTranscriptDocx(projectFixture(), new Date('2026-08-05T01:00:00.000Z'));
  assert.equal(buffer.subarray(0, 2).toString(), 'PK');
  assert.ok(buffer.length > 1000);
});

test('formats document metadata and safe filenames', () => {
  assert.equal(formatTimestamp(65000), '1:05');
  assert.match(readableDocumentTitle(projectFixture()), /^Guard — July 20, 2026$/);
  assert.equal(safeDocumentName('Guard: Interview / July 20'), 'Guard Interview July 20.docx');
});
