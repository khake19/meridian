#!/usr/bin/env python3
"""Newline-delimited JSON sidecar for mock and WhisperX transcription."""

import json
import os
import sys
import time
import traceback
from pathlib import Path

from audio import load_audio

DIARIZATION_MODEL = "pyannote/speaker-diarization-community-1"


def emit(message):
    print(json.dumps({"protocolVersion": 1, **message}, ensure_ascii=False), flush=True)


def mock_transcribe(request):
    job_id = request["jobId"]
    audio_path = request["audioPath"]
    emit({"type": "stage.started", "jobId": job_id, "stage": "transcription"})
    emit({"type": "stage.progress", "jobId": job_id, "percent": 45, "stage": "transcription"})
    time.sleep(0.2)
    emit({"type": "stage.completed", "jobId": job_id, "stage": "transcription"})
    emit({"type": "stage.started", "jobId": job_id, "stage": "alignment"})
    if request.get("simulateAlignmentFailure"):
        emit({
            "type": "stage.failed",
            "jobId": job_id,
            "stage": "alignment",
            "code": "ALIGNMENT_FAILED",
            "message": "Word alignment failed; the raw transcript was preserved.",
            "recoverable": True,
        })
    else:
        emit({"type": "stage.progress", "jobId": job_id, "percent": 80, "stage": "alignment"})
        time.sleep(0.2)
        emit({"type": "stage.completed", "jobId": job_id, "stage": "alignment"})
    diarization_succeeded = bool(request.get("simulateDiarization"))
    if diarization_succeeded:
        emit({"type": "stage.started", "jobId": job_id, "stage": "diarization"})
        emit({"type": "stage.completed", "jobId": job_id, "stage": "diarization"})
    else:
        emit({
            "type": "stage.skipped",
            "jobId": job_id,
            "stage": "diarization",
            "reason": "Speaker diarization is not configured for this mock request.",
        })

    emit({
        "type": "job.completed",
        "jobId": job_id,
        "backend": "mock",
        "model": None,
        "language": "en",
        "elapsedMs": 400,
        "status": "completed" if diarization_succeeded and not request.get("simulateAlignmentFailure") else "partial",
        "segments": [{
            "start": 0.0,
            "end": 2.4,
            "text": "Mock transcript for {}.".format(Path(audio_path).name),
            "speaker": "SPEAKER_00",
        }],
    })


def inspect_media(request):
    import av

    media_path = request["mediaPath"]
    with av.open(media_path) as container:
        audio_streams = [stream for stream in container.streams if stream.type == "audio"]
        if not audio_streams:
            raise ValueError("The selected file does not contain an audio stream")
        if container.duration is not None:
            duration_ms = round(container.duration / 1000)
        else:
            stream = audio_streams[0]
            if stream.duration is None or stream.time_base is None:
                raise ValueError("Unable to determine the recording duration")
            duration_ms = round(float(stream.duration * stream.time_base) * 1000)

    emit({
        "type": "media.inspected",
        "jobId": request["jobId"],
        "durationMs": duration_ms,
    })


def diarization_model_installed(model_root):
    repository = model_root / "models--pyannote--speaker-diarization-community-1"
    snapshots = repository / "snapshots"
    if not snapshots.is_dir():
        return False
    return any((snapshot / "config.yaml").exists() for snapshot in snapshots.iterdir())


def diarization_status(request):
    model_root = Path(os.environ.get("MERIDIAN_MODEL_DIR", Path.home() / ".cache" / "meridian" / "models"))
    emit({
        "type": "diarization.status",
        "jobId": request["jobId"],
        "installed": diarization_model_installed(model_root),
        "model": DIARIZATION_MODEL,
    })


def install_diarization(request):
    token = request.get("token")
    if not isinstance(token, str) or not token.startswith("hf_"):
        raise ValueError("A valid Hugging Face token is required")
    model_root = Path(os.environ.get("MERIDIAN_MODEL_DIR", Path.home() / ".cache" / "meridian" / "models"))
    model_root.mkdir(parents=True, exist_ok=True)
    emit({"type": "diarization.installing", "jobId": request["jobId"], "percent": 10})
    try:
        from whisperx.diarize import DiarizationPipeline

        pipeline = DiarizationPipeline(
            model_name=DIARIZATION_MODEL,
            token=token,
            device="cpu",
            cache_dir=str(model_root),
        )
        del pipeline
    finally:
        token = None
        request.pop("token", None)

    if not diarization_model_installed(model_root):
        raise RuntimeError("The speaker model download did not complete")
    emit({
        "type": "diarization.installed",
        "jobId": request["jobId"],
        "installed": True,
        "model": DIARIZATION_MODEL,
    })


def whisperx_transcribe(request):
    import torch
    import whisperx

    job_id = request["jobId"]
    audio_path = request["audioPath"]
    device = "cuda" if torch.cuda.is_available() else "cpu"
    compute_type = "float16" if device == "cuda" else "int8"
    allowed_models = {"medium", "large-v3"}
    model_name = request.get("model") or os.environ.get("MERIDIAN_WHISPER_MODEL", "medium")
    if model_name not in allowed_models:
        raise ValueError("Unsupported Whisper model: {}".format(model_name))
    started_at = time.monotonic()

    emit({"type": "stage.started", "jobId": job_id, "stage": "transcription"})
    emit({"type": "stage.progress", "jobId": job_id, "percent": 10, "stage": "transcription"})
    model_root = Path(os.environ.get("MERIDIAN_MODEL_DIR", Path.home() / ".cache" / "meridian" / "models"))
    model_root.mkdir(parents=True, exist_ok=True)

    model = whisperx.load_model(
        model_name,
        device,
        compute_type=compute_type,
        download_root=str(model_root),
    )
    audio = load_audio(audio_path)
    emit({"type": "stage.progress", "jobId": job_id, "percent": 35, "stage": "transcription"})
    transcription_result = model.transcribe(audio, batch_size=4)
    language = transcription_result["language"]
    emit({"type": "stage.completed", "jobId": job_id, "stage": "transcription"})

    emit({"type": "stage.started", "jobId": job_id, "stage": "alignment"})
    emit({"type": "stage.progress", "jobId": job_id, "percent": 70, "stage": "alignment"})
    segments = transcription_result.get("segments", [])
    alignment_succeeded = False
    try:
        align_model, metadata = whisperx.load_align_model(
            language,
            device,
            model_dir=str(model_root),
        )
        aligned_result = whisperx.align(segments, align_model, metadata, audio, device)
        segments = aligned_result.get("segments", segments)
        alignment_succeeded = True
        emit({"type": "stage.completed", "jobId": job_id, "stage": "alignment"})
    except Exception:
        emit({
            "type": "stage.failed",
            "jobId": job_id,
            "stage": "alignment",
            "code": "ALIGNMENT_FAILED",
            "message": "Word alignment failed; the raw transcript was preserved.",
            "recoverable": True,
        })
        traceback.print_exc(file=sys.stderr)

    diarization_succeeded = False
    emit({"type": "stage.started", "jobId": job_id, "stage": "diarization"})
    emit({"type": "stage.progress", "jobId": job_id, "percent": 85, "stage": "diarization"})
    try:
        from whisperx.diarize import DiarizationPipeline

        diarization_model = DiarizationPipeline(
            token=os.environ.get("HF_TOKEN"),
            device=device,
            cache_dir=str(model_root),
        )
        speaker_count = request.get("speakerCount")
        if speaker_count is not None and speaker_count not in (2, 3, 4):
            raise ValueError("Speaker count must be 2, 3, or 4")
        diarization_options = {"num_speakers": speaker_count} if speaker_count is not None else {}
        diarization_segments = diarization_model(audio, **diarization_options)
        speaker_result = whisperx.assign_word_speakers(
            diarization_segments,
            {"segments": segments},
        )
        segments = speaker_result.get("segments", segments)
        diarization_succeeded = True
        emit({"type": "stage.completed", "jobId": job_id, "stage": "diarization"})
    except Exception:
        emit({
            "type": "stage.failed",
            "jobId": job_id,
            "stage": "diarization",
            "code": "DIARIZATION_FAILED",
            "message": "Speaker detection failed; the transcript was preserved. Check model access and try again.",
            "recoverable": True,
        })
        traceback.print_exc(file=sys.stderr)

    emit({
        "type": "job.completed",
        "jobId": job_id,
        "backend": "whisperx",
        "model": model_name,
        "language": language,
        "elapsedMs": round((time.monotonic() - started_at) * 1000),
        "status": "completed" if alignment_succeeded and diarization_succeeded else "partial",
        "segments": segments,
    })


def handle(request):
    if request.get("protocolVersion") != 1:
        raise ValueError("Unsupported protocol version")
    if request.get("type") == "media.inspect":
        if not request.get("jobId") or not request.get("mediaPath"):
            raise ValueError("jobId and mediaPath are required")
        inspect_media(request)
        return
    if request.get("type") == "diarization.status":
        if not request.get("jobId"):
            raise ValueError("jobId is required")
        diarization_status(request)
        return
    if request.get("type") == "diarization.install":
        if not request.get("jobId"):
            raise ValueError("jobId is required")
        install_diarization(request)
        return
    if request.get("type") != "transcribe":
        raise ValueError("Unsupported message type")
    if not request.get("jobId") or not request.get("audioPath"):
        raise ValueError("jobId and audioPath are required")

    backend = request.get("backend", "mock")
    if backend == "mock":
        mock_transcribe(request)
    elif backend == "whisperx":
        whisperx_transcribe(request)
    else:
        raise ValueError("Unsupported backend: {}".format(backend))


def main():
    for line in sys.stdin:
        try:
            request = json.loads(line)
            handle(request)
        except Exception as error:
            emit({
                "type": "job.failed",
                "jobId": locals().get("request", {}).get("jobId"),
                "code": "WORKER_ERROR",
                "message": str(error),
            })
            traceback.print_exc(file=sys.stderr)


if __name__ == "__main__":
    main()
