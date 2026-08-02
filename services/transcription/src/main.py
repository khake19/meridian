#!/usr/bin/env python3
"""Newline-delimited JSON sidecar for mock and WhisperX transcription."""

import json
import os
import sys
import time
import traceback
from pathlib import Path

from audio import load_audio


def emit(message):
    print(json.dumps({"protocolVersion": 1, **message}, ensure_ascii=False), flush=True)


def mock_transcribe(request):
    job_id = request["jobId"]
    audio_path = request["audioPath"]
    for percent, stage in ((10, "transcription"), (45, "transcription"), (80, "alignment")):
        emit({"type": "stage.progress", "jobId": job_id, "percent": percent, "stage": stage})
        time.sleep(0.2)

    emit({
        "type": "job.completed",
        "jobId": job_id,
        "backend": "mock",
        "model": None,
        "language": "en",
        "elapsedMs": 600,
        "status": "completed",
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
    result = model.transcribe(audio, batch_size=4)
    language = result["language"]
    emit({"type": "stage.completed", "jobId": job_id, "stage": "transcription"})

    emit({"type": "stage.started", "jobId": job_id, "stage": "alignment"})
    emit({"type": "stage.progress", "jobId": job_id, "percent": 70, "stage": "alignment"})
    align_model, metadata = whisperx.load_align_model(
        language,
        device,
        model_dir=str(model_root),
    )
    result = whisperx.align(result["segments"], align_model, metadata, audio, device)
    emit({"type": "stage.completed", "jobId": job_id, "stage": "alignment"})

    emit({
        "type": "job.completed",
        "jobId": job_id,
        "backend": "whisperx",
        "model": model_name,
        "language": language,
        "elapsedMs": round((time.monotonic() - started_at) * 1000),
        "status": "partial",
        "segments": result.get("segments", []),
    })


def handle(request):
    if request.get("protocolVersion") != 1:
        raise ValueError("Unsupported protocol version")
    if request.get("type") == "media.inspect":
        if not request.get("jobId") or not request.get("mediaPath"):
            raise ValueError("jobId and mediaPath are required")
        inspect_media(request)
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
