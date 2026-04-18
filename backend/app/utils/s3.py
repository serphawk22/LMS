import boto3
from botocore.exceptions import BotoCoreError, ClientError
from typing import Any


class S3StorageClient:
    def __init__(
        self,
        bucket_name: str,
        region: str,
        aws_access_key_id: str | None = None,
        aws_secret_access_key: str | None = None,
    ):
        self.bucket_name = bucket_name
        self.region = region
        self.base_url = f"https://{bucket_name}.s3.{region}.amazonaws.com"
        self.client = boto3.client(
            "s3",
            region_name=region,
            aws_access_key_id=aws_access_key_id,
            aws_secret_access_key=aws_secret_access_key,
        )

    def upload_file(self, key: str, body: bytes, content_type: str) -> dict[str, Any]:
        try:
            self.client.put_object(Bucket=self.bucket_name, Key=key, Body=body, ContentType=content_type)
        except (BotoCoreError, ClientError) as exc:
            raise RuntimeError("Failed to upload file to S3.") from exc

        return {
            "bucket": self.bucket_name,
            "key": key,
            "content_type": content_type,
            "url": f"{self.base_url}/{key}",
        }

    def generate_presigned_url(self, key: str, expires_in: int = 900) -> str:
        try:
            return self.client.generate_presigned_url(
                "get_object",
                Params={"Bucket": self.bucket_name, "Key": key},
                ExpiresIn=expires_in,
            )
        except (BotoCoreError, ClientError) as exc:
            raise RuntimeError("Failed to generate presigned URL for S3 object.") from exc
