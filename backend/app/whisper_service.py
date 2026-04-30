import json
import os
from pathlib import Path
from typing import Any

from openai import OpenAI

from app.config import settings


def _to_dict(response: Any) -> dict[str, Any]:
    if isinstance(response, dict):
        return response
    if hasattr(response, "to_dict"):
        return response.to_dict()
    if hasattr(response, "dict"):
        return response.dict()
    return dict(response)


def transcribe_with_timestamps(video_path: str) -> list[dict[str, Any]]:
    """Transcribe a local video file using OpenAI Whisper model with timestamps."""
    video_file_path = Path(video_path)
    print(f"Whisper service: transcribing file at {video_file_path}")

    if not video_file_path.exists():
        raise FileNotFoundError(f"Video file not found: {video_file_path}")

    if settings.openai_api_key is None:
        raise ValueError("OPENAI_API_KEY is not configured in environment.")

    client = OpenAI(api_key=settings.openai_api_key)

    with video_file_path.open("rb") as video_file:
        response = client.audio.transcriptions.create(
            model="gpt-4o-transcribe",
            file=video_file,
            response_format="verbose_json",
        )

    result = _to_dict(response)
    segments = result.get("segments")
    print(f"Whisper service: received transcription response with {len(segments) if segments else 0} segments")

    if not segments:
        raise ValueError("Transcription response did not include timestamp segments.")

    output_segments: list[dict[str, Any]] = []
    for segment in segments:
        start = segment.get("start")
        end = segment.get("end")
        text = segment.get("text")

        if start is None or end is None or text is None:
            continue

        output_segments.append(
            {
                "start": float(start),
                "end": float(end),
                "text": str(text).strip(),
            }
        )

    return output_segments


def translate_text(text: str, target_language: str) -> str:
    """Translate text into a target language with OpenAI chat completions."""
    if not text:
        return ""

    if settings.openai_api_key is None:
        raise ValueError("OPENAI_API_KEY is not configured in environment.")

    language_labels = {
        "te": "Telugu",
        "ta": "Tamil",
        "kn": "Kannada",
    }

    language_name = language_labels.get(target_language, target_language)
    client = OpenAI(api_key=settings.openai_api_key)

    print(f"Whisper service: translating text into {language_name}")
    prompt = (
        f"Translate the following text into {language_name}. "
        "Keep the output clean, concise, and subtitle-friendly. "
        "Do not add extra commentary or formatting.\n\n"
        f"Text: {text.strip()}"
    )

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a subtitle translator."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.2,
            max_tokens=250,
        )
        payload = _to_dict(response)
        translated = payload.get("choices", [])[0].get("message", {}).get("content", "")
        return str(translated).strip()
    except Exception as exc:
        print(f"Whisper service: translation error for {target_language}: {exc}")
        raise


def translate_segments(segments: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    """Translate a list of subtitle segments into multiple languages."""
    if not segments:
        return {"en": [], "te": [], "ta": [], "kn": []}

    translated_segments = {
        "en": [],
        "te": [],
        "ta": [],
        "kn": [],
    }

    print("Whisper service: translating segments")
    for segment in segments:
        original_text = str(segment.get("text", "")).strip()
        translated_segments["en"].append({
            "start": segment["start"],
            "end": segment["end"],
            "text": original_text,
        })

        for lang in ["te", "ta", "kn"]:
            print(f"Whisper service: translating segment to {lang}")
            translated_text = translate_text(original_text, lang)
            translated_segments[lang].append({
                "start": segment["start"],
                "end": segment["end"],
                "text": translated_text,
            })

    return translated_segments


def save_subtitles(course_id: int, data: dict[str, list[dict[str, Any]]]) -> Path:
    """Save translated subtitle data to the uploads/subtitles folder."""
    subtitle_dir = Path(__file__).resolve().parent.parent / "uploads" / "subtitles"
    os.makedirs(subtitle_dir, exist_ok=True)
    print(f"Subtitles folder ensured: {subtitle_dir}")

    subtitle_path = subtitle_dir / f"course_{course_id}.json"
    with subtitle_path.open("w", encoding="utf-8") as subtitle_file:
        json.dump(data, subtitle_file, ensure_ascii=False, indent=4)

    print(f"Saved subtitle file at: {subtitle_path}")
    return subtitle_path
