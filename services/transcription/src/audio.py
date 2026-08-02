"""Decode media in-process so the packaged app does not depend on FFmpeg CLI."""

import av
import numpy as np


SAMPLE_RATE = 16_000


def load_audio(audio_path):
    chunks = []
    resampler = av.AudioResampler(format="s16", layout="mono", rate=SAMPLE_RATE)

    with av.open(audio_path) as container:
        if not container.streams.audio:
            raise ValueError("The selected file does not contain an audio stream.")

        for frame in container.decode(audio=0):
            for resampled in resampler.resample(frame):
                chunks.append(resampled.to_ndarray().reshape(-1))

        for resampled in resampler.resample(None):
            chunks.append(resampled.to_ndarray().reshape(-1))

    if not chunks:
        raise ValueError("No audio samples could be decoded from the selected file.")

    return np.concatenate(chunks).astype(np.float32) / 32768.0
