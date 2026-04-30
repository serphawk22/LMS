from pytest import raises

from app.schemas.course import LessonContentType
from app.services.courses import _validate_lesson_content_payload


def test_validate_youtube_embed_content_payload_valid():
    payload = {"youtube_id": "dQw4w9WgXcQ", "start_time_seconds": 30}
    validated = _validate_lesson_content_payload(LessonContentType.youtube_embed, payload)

    assert validated["youtube_id"] == "dQw4w9WgXcQ"
    assert validated["start_time_seconds"] == 30


def test_validate_youtube_embed_content_payload_missing_required_field_raises():
    payload = {"start_time_seconds": 30}
    with raises(ValueError, match="Invalid content_payload for lesson type 'youtube_embed'"):
        _validate_lesson_content_payload(LessonContentType.youtube_embed, payload)


def test_validate_text_content_payload_valid():
    payload = {"body": "This is a text lesson."}
    validated = _validate_lesson_content_payload(LessonContentType.text, payload)

    assert validated == payload
