# Meridian — Product Requirements Document

**Version:** 0.1  
**Status:** Draft  
**Date:** 1 August 2026  
**Initial platform:** Windows desktop  
**Product type:** Offline-first interview transcription and investigation review workspace

## 1. Product Summary

Meridian is a desktop application that helps workplace investigators turn recorded interviews into accurate, reviewable transcripts. It runs transcription and speaker diarization locally, synchronizes the transcript with the original audio, and provides tools for correcting and organizing the record.

The product assists the investigation process. It does not determine whether an allegation is true, recommend disciplinary action, or replace human judgment.

## 2. Problem

Workplace investigators often review long interview recordings and manually create transcripts. This process is slow, repetitive, and vulnerable to transcription mistakes. General-purpose transcription tools may also be unsuitable because recordings can contain confidential employee and incident information.

An early test using a real workplace interview and a local Whisper model produced an estimated 90% accurate transcript. This validates local AI transcription as a useful starting point, but the remaining review work still needs a purpose-built interface for audio playback, timestamp navigation, speaker correction, editing, and safe local persistence.

## 3. Vision

Enable an investigator to move from a raw interview recording to a reviewed, human-approved transcript substantially faster, while preserving confidentiality and keeping the investigator in control.

## 4. Goals

### 4.1 Product goals

- Reduce the time required to produce a reviewed interview transcript.
- Keep recordings, transcripts, and AI processing on the user's computer.
- Produce timestamped, speaker-separated draft transcripts from real interviews.
- Make correction faster through synchronized audio and transcript navigation.
- Preserve the original recording and all saved corrections.
- Establish a foundation that can later support complete investigation case management.

### 4.2 Milestone 1 goal

Deliver one complete local review workflow:

> Import one recording → transcribe and diarize locally → review with synchronized audio → correct text and speakers → save → reopen and continue.

## 5. Non-goals for Milestone 1

Milestone 1 will not include:

- Full case creation and case metadata
- Multiple recordings under one case
- Findings, allegation assessment, or disciplinary recommendations
- AI-generated conclusions or summaries
- Cloud storage or synchronization
- Multi-user collaboration
- Mobile or web applications
- Bookmarks, investigation notes, tags, or evidence attachments
- DOCX or PDF export
- Formal audit history
- At-rest encryption
- Automatic application updates
- Cross-platform packaging beyond the initial Windows target

These may be added in later milestones after the core review workflow is validated with actual users.

## 6. Target Users

### Primary user: Workplace investigator

A professional who conducts or reviews internal workplace interviews concerning attendance, conduct, policy violations, minor offenses, major offenses, or other incidents.

**Needs:**

- A fast draft transcript from a real recording
- Clear identification of different speakers
- Easy replay of uncertain statements
- Confidence that corrections are saved
- Confidential local processing
- A reliable reviewed record that can later be included in a case file

### Secondary user: HR reviewer or investigation manager

A person who may later review an approved transcript or supporting case material. Direct collaboration is outside Milestone 1.

## 7. Assumptions and Constraints

- The first deployment is intended for the user's wife's Windows computer.
- Interviews may contain English, Filipino, or Taglish.
- Audio quality, background noise, overlapping speech, accents, and names will affect accuracy.
- AI output is always a draft requiring human review.
- WhisperX is the initial processing engine and will run as a local Python worker.
- Electron will provide the desktop shell because the developer already has Electron experience.
- The architecture must allow the transcription engine to be replaced later.
- Speaker diarization may produce generic labels and occasional mistakes.
- Models and AI dependencies may require several gigabytes of disk space.

## 8. User Journey

1. The investigator opens Meridian.
2. The investigator selects an interview recording.
3. Meridian copies the recording into a local review project and records its integrity hash.
4. The investigator starts processing.
5. Meridian shows progress for transcription, alignment, and speaker diarization.
6. Completed transcript segments appear with timestamps and generic speaker labels.
7. The investigator renames speakers, such as `SPEAKER_00` to `Investigator`.
8. The investigator clicks a segment to hear the corresponding audio.
9. The investigator corrects text and speaker assignments while listening.
10. Changes are saved automatically.
11. The investigator closes and later reopens the project without losing work or playback position.

## 9. Functional Requirements

Priority definitions:

- **P0:** Required for Milestone 1
- **P1:** Important immediately after the core workflow
- **P2:** Future capability

### 9.1 Recording import and preservation

| ID | Requirement | Priority |
|---|---|---|
| FR-001 | The user can select a local WAV, MP3, M4A, or MP4 recording. | P0 |
| FR-002 | The application creates a local review project automatically when a recording is imported. | P0 |
| FR-003 | The application copies the original recording into the project without modifying it. | P0 |
| FR-004 | The application records the original filename, file size, duration, import date, and SHA-256 hash. | P0 |
| FR-005 | The application rejects unreadable or unsupported files with a clear message. | P0 |

### 9.2 Local AI processing

| ID | Requirement | Priority |
|---|---|---|
| FR-010 | The user can start local processing without opening a terminal. | P0 |
| FR-011 | WhisperX performs transcription, word alignment, and speaker diarization as separate stages. | P0 |
| FR-012 | The UI shows the current processing stage and available progress information. | P0 |
| FR-013 | The worker emits structured events that the desktop application can validate and display. | P0 |
| FR-014 | A diarization or alignment failure does not discard an otherwise successful transcript. | P0 |
| FR-015 | The application records processing duration, engine version, model, language, and outcome. | P0 |
| FR-016 | The user can configure or confirm the expected number of speakers before diarization. | P1 |
| FR-017 | The user can cancel a processing job safely. | P1 |
| FR-018 | The application can retry a failed processing stage. | P1 |

### 9.3 Transcript review

| ID | Requirement | Priority |
|---|---|---|
| FR-020 | The application displays transcript segments with start time, end time, text, and speaker. | P0 |
| FR-021 | The application provides local audio playback controls. | P0 |
| FR-022 | Clicking a transcript segment seeks playback to its start time. | P0 |
| FR-023 | The currently playing segment is visually highlighted. | P0 |
| FR-024 | The user can edit transcript text. | P0 |
| FR-025 | The user can change the speaker assigned to a segment. | P0 |
| FR-026 | The user can rename a generic speaker globally within the project. | P0 |
| FR-027 | The user can pause, resume, seek, and change playback speed. | P0 |
| FR-028 | The user can move to the previous or next segment using keyboard controls. | P1 |
| FR-029 | The user can search transcript text. | P1 |

### 9.4 Persistence and recovery

| ID | Requirement | Priority |
|---|---|---|
| FR-030 | Transcript and speaker corrections are automatically saved locally. | P0 |
| FR-031 | The application restores the project, transcript, processing status, and last playback position after restart. | P0 |
| FR-032 | Saving uses safe writes so an interruption does not corrupt the last valid project state. | P0 |
| FR-033 | Worker failures are recorded and shown without making the project unusable. | P0 |
| FR-034 | The application clearly indicates saving, saved, and save-failed states. | P0 |

### 9.5 Future case management

| ID | Requirement | Priority |
|---|---|---|
| FR-100 | The user can create a case with a case number, title, incident type, subject, and status. | P2 |
| FR-101 | A case can contain multiple interview recordings and reviewed transcripts. | P2 |
| FR-102 | The user can add notes, bookmarks, tags, and supporting evidence. | P2 |
| FR-103 | The user can export a human-approved transcript to DOCX and PDF. | P2 |
| FR-104 | The product records a review and approval status without generating an investigative finding. | P2 |

## 10. Transcript Data Requirements

Each transcript segment must support:

```ts
type TranscriptSegment = {
  id: string;
  start: number;
  end: number;
  text: string;
  speakerId: string | null;
  originalText: string;
  confidence?: number;
  words?: Array<{
    text: string;
    start: number;
    end: number;
    confidence?: number;
  }>;
  updatedAt: string;
};
```

The original AI output must be retained separately from the current human-edited text so future review history can be added without rerunning transcription.

## 11. Processing Architecture

```text
Electron + React UI
        ↓ secure IPC
Electron main process
        ↓ JSON Lines over stdin/stdout
Local Python worker
        ↓
WhisperX pipeline
  1. Transcription
  2. Word alignment
  3. Speaker diarization
```

Architectural requirements:

- The renderer must not directly access arbitrary files or start processes.
- Only the Electron main process may manage recordings and the worker.
- The worker protocol must be versioned and engine-independent.
- Each processing stage must return its own success or failure result.
- Partial results must be persisted whenever usable.
- Model files and the original recording must not be sent over the network.

## 12. Non-functional Requirements

### Privacy and security

- All transcription, alignment, diarization, playback, and persistence must work offline after initial installation and model setup.
- No recording or transcript content may leave the computer unless a future explicit export or sync feature is initiated by the user.
- The application must follow Electron security guidance: context isolation enabled, Node integration disabled in the renderer, validated IPC channels, and least-privilege file access.
- Sensitive recording paths and transcript content must not be written to general diagnostic logs.
- Encryption at rest is deferred, but storage boundaries must allow it to be introduced later.

### Reliability

- A failed or terminated worker must not corrupt the imported recording or previously saved transcript.
- The user must be able to reopen the last valid saved state after an application crash.
- The original recording must remain unchanged.

### Performance

- The UI must remain responsive while processing is running.
- Transcript editing and seeking should feel immediate for interviews of at least two hours.
- Processing speed will vary by hardware; the app must report elapsed time rather than promise a fixed completion time.

### Accessibility and usability

- Primary review actions must be keyboard accessible.
- Processing, saving, selected speaker, and playback states must not rely on color alone.
- Errors must explain what failed and what the user can do next.

### Maintainability

- The WhisperX implementation must conform to a replaceable transcription-engine interface.
- Worker event and result schemas must be validated at runtime.
- The project must include automated tests for parsing worker events and persisting transcript edits.

## 13. Success Metrics

The initial pilot will compare Meridian with the current manual workflow.

| Metric | Initial target |
|---|---|
| End-to-end local processing success | At least 90% of representative recordings complete without manual technical intervention |
| Transcript completeness | No unexplained missing multi-second speech sections in the pilot recordings |
| Draft usefulness | Investigator considers the draft faster to correct than transcribing from scratch |
| Review time | At least 40% less time than fully manual transcription, measured across several interviews |
| Edit persistence | No lost saved corrections during normal close/reopen testing |
| Speaker workflow | Speaker labels can be corrected without rerunning transcription |
| Privacy | No recording or transcript network transmission during normal use |

Accuracy should be evaluated on representative English, Filipino, and Taglish recordings. A single word-error-rate target will not by itself determine success because names, dates, policy terms, speaker assignment, and missing statements have different investigative importance.

## 14. Milestone 1 Acceptance Criteria

Milestone 1 is complete when:

1. The application launches on the target Windows computer.
2. The user can import a representative interview recording.
3. The original recording is copied, hashed, and never modified.
4. WhisperX runs from the application without terminal commands.
5. The user sees separate transcription, alignment, and diarization states.
6. A successful transcript remains available if alignment or diarization fails.
7. Transcript segments display timestamps, editable text, and speaker labels.
8. Clicking a segment seeks playback to approximately the correct point.
9. The active segment follows audio playback.
10. The user can rename speakers and correct segment assignments.
11. Text and speaker corrections auto-save.
12. Closing and reopening restores the transcript, corrections, and playback position.
13. A processing or save failure does not corrupt the project.
14. The complete workflow is tested with at least three representative recordings, including one long interview and one Taglish interview.
15. The investigator confirms that correcting the generated transcript is meaningfully faster than manual transcription.

## 15. Delivery Plan

### Milestone 1 — Local transcript review

- Recording import and preservation
- WhisperX worker integration
- Progress and failure handling
- Timestamped speaker transcript
- Synchronized audio playback
- Text and speaker correction
- Auto-save and reopen

### Milestone 2 — Review productivity

- Keyboard-first review controls
- Transcript search
- Bookmarks and review notes
- Better correction of speaker boundaries
- Processing settings and retry controls

### Milestone 3 — Case management

- Case creation and case metadata
- Multiple interviews per case
- Participants and evidence organization
- Review and approval status

### Milestone 4 — Professional output

- DOCX, PDF, and plain-text export
- Export templates and headers
- Page numbers, timestamps, and speaker formatting
- Human-approval marker and original-recording reference

### Milestone 5 — Distribution and hardening

- Clean Windows installer
- Packaged worker and model management
- Hardware detection and CPU/GPU selection
- Encryption and formal audit history
- Backup, recovery, diagnostics, and pilot rollout

## 16. Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| WhisperX packaging is large or unreliable | Installation may fail on clean machines | Develop with an isolated worker, test a clean Windows installation early, and keep the engine replaceable |
| Pyannote model redistribution or licensing limits | Commercial distribution may require a different setup | Review licenses before bundling; support user-provided model setup during development |
| Speaker diarization errors | Statements may be attributed to the wrong person | Treat output as a draft; provide fast speaker rename and reassignment controls |
| Overlapping speech and poor audio reduce accuracy | Review time may remain high | Preserve word timestamps and audio navigation; test with representative recordings |
| Taglish, names, and company terminology are misrecognized | Important details may be incorrect | Support correction, future hotwords/glossaries, and targeted pilot evaluation |
| AI output is treated as authoritative | Investigation quality and fairness may be harmed | Clearly label output as AI-generated draft and require human review |
| Confidential data is exposed in logs or cloud services | Privacy and employment risk | Offline processing, restricted logs, least-privilege IPC, and no telemetry containing case content |

## 17. Open Decisions

- Which Whisper model and compute settings give the best accuracy/speed balance on the target computer?
- Will the first packaged build support CPU only, NVIDIA GPU, or both?
- Can required WhisperX and pyannote models legally be redistributed in a commercial installer?
- Should model files ship with the installer or be downloaded during setup?
- Which local persistence design will be used initially: SQLite plus project files, or a project-file format backed by SQLite?
- Which exact audio and video formats must be supported in the pilot?
- What review-time reduction does the investigator achieve on three to five real interviews?

## 18. Product Principles

1. **Human-reviewed, never AI-decided.** AI creates a draft; the investigator owns the record and any conclusion.
2. **Local by default.** Confidential interview content stays on the user's computer.
3. **Preserve the source.** The original recording is immutable and traceable.
4. **Partial success is useful.** A transcript remains valuable even if alignment or diarization fails.
5. **Optimize for review, not novelty.** Every feature should reduce the time or effort needed to produce an accurate record.
6. **Build from real interviews.** Product decisions will be validated using representative recordings and actual investigator feedback.
