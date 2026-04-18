#!/usr/bin/env python
try:
    from app.routers import transcription
    print("transcription module imported successfully")
    print("router object:", transcription.router)
except Exception as e:
    print(f"Error importing transcription: {e}")
    import traceback
    traceback.print_exc()
