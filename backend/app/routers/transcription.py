import json
import os
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, status

router = APIRouter()


@router.get("/transcribe/{course_id}", response_model=dict[str, str])
def transcribe_course_video(course_id: int):
    """Test endpoint: Create dummy subtitle JSON without video processing."""
    print("API HIT")
    print("Current working directory:", os.getcwd())

    try:
        print("Creating folder")
        os.makedirs("uploads/subtitles", exist_ok=True)
        print("Subtitles folder created at:", os.path.abspath("uploads/subtitles"))

        subtitle_data = {
            "en": [
                {"start": 0, "end": 5, "text": "Welcome to deep learning"}
            ],
            "te": [
                {"start": 0, "end": 5, "text": "డీప్ లెర్నింగ్ కు స్వాగతం"}
            ],
        }

        print("Saving file")
        file_path = f"uploads/subtitles/course_{course_id}.json"
        with open(file_path, "w", encoding="utf-8") as subtitle_file:
            json.dump(subtitle_data, subtitle_file, indent=4)

        print("Done")
        print("File exists:", os.path.exists(file_path))
        print("Full file path:", os.path.abspath(file_path))

        return {
            "status": "success",
            "message": f"Dummy subtitles saved for course {course_id}",
            "subtitle_path": file_path,
        }
    except Exception as exc:
        print(f"Error in /transcribe route: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create dummy subtitles.",
        ) from exc


@router.get("/subtitles/{course_id}", response_model=dict[str, list[dict[str, Any]]])
def get_subtitles(course_id: int):
    """Fetch subtitles for a course."""
    uploads_dir = Path(__file__).resolve().parents[2] / "uploads"
    subtitle_path = uploads_dir / "subtitles" / f"course_{course_id}.json"

    if not subtitle_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Subtitles not found for course {course_id}",
        )

    try:
        with subtitle_path.open("r", encoding="utf-8") as subtitle_file:
            subtitles = json.load(subtitle_file)
        return subtitles
    except Exception as exc:
        print(f"Get subtitles error: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load subtitles.",
        ) from exc
