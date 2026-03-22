import boto3
import os
import uuid
from botocore.client import Config


def upload_employee_image(file_bytes: bytes, content_type: str) -> str:
    endpoint   = os.getenv("S3_ENDPOINT_URL", "https://nbg1.your-objectstorage.com")
    bucket     = os.getenv("S3_BUCKET", "professorprimedev")
    access     = os.getenv("S3_ACCESS_KEY")
    secret     = os.getenv("S3_SECRET_KEY")
    public_url = os.getenv("S3_PUBLIC_URL", "https://professorprimedev.nbg1.your-objectstorage.com")

    ext = content_type.split("/")[-1].replace("jpeg", "jpg")
    key = f"employees/{uuid.uuid4().hex}.{ext}"
    s3 = boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=access,
        aws_secret_access_key=secret,
        config=Config(signature_version="s3v4"),
    )
    s3.put_object(Bucket=bucket, Key=key, Body=file_bytes, ContentType=content_type, ACL="public-read")
    return f"{public_url}/{key}"
