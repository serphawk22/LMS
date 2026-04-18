from pydantic import BaseModel


class FileMetadataRead(BaseModel):
    key: str
    filename: str
    content_type: str
    size: int
    url: str


class FileDownloadRead(BaseModel):
    key: str
    filename: str
    url: str
