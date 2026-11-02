"""Uploaded media storage.

Local dev writes under ``MEDIA_ROOT`` and serves files from ``/media``. On Vercel
the filesystem is read-only, so when ``BLOB_READ_WRITE_TOKEN`` is set files go to
Vercel Blob and the stored URL is the absolute public Blob URL.
"""

from __future__ import annotations

import mimetypes
from pathlib import Path

import aiofiles
from fastapi import HTTPException, UploadFile

from app.core.config import get_settings

MAX_UPLOAD_BYTES = 4 * 1024 * 1024  # Vercel request bodies are capped at 4.5MB


def use_blob() -> bool:
    return bool(get_settings().blob_read_write_token)


def _content_type(key: str, content_type: str | None) -> str | None:
    return content_type or mimetypes.guess_type(key)[0]


def _local_path(url: str) -> Path | None:
    settings = get_settings()
    prefix = settings.media_url_prefix.rstrip("/")
    if not url.startswith(prefix + "/"):
        return None
    return Path(settings.media_root) / url[len(prefix) + 1 :]


async def save_bytes(key: str, data: bytes, content_type: str | None = None) -> str:
    """Store ``data`` at ``key`` (e.g. ``abc/logo.png``) and return its public URL."""
    settings = get_settings()
    if use_blob():
        from vercel import blob

        result = await blob.put_blob(
            key,
            data,
            access="public",
            content_type=_content_type(key, content_type),
            allow_overwrite=True,
        )
        return result.url

    dest = Path(settings.media_root) / key
    dest.parent.mkdir(parents=True, exist_ok=True)
    async with aiofiles.open(dest, "wb") as out:
        await out.write(data)
    return f"{settings.media_url_prefix}/{key}"


async def save_upload(key: str, file: UploadFile) -> str:
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="File too large (max 4MB)")
    return await save_bytes(key, data, file.content_type)


def write_text(key: str, content: str) -> str:
    settings = get_settings()
    data = content.encode("utf-8")
    if use_blob():
        from vercel.blob import sync as blob

        result = blob.put_blob(
            key,
            data,
            access="public",
            content_type="text/html; charset=utf-8",
            allow_overwrite=True,
        )
        return result.url

    dest = Path(settings.media_root) / key
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    return f"{settings.media_url_prefix}/{key}"


def read_text(url: str) -> str | None:
    if not url:
        return None
    path = _local_path(url)
    if path is not None:
        if not path.is_file():
            return None
        return path.read_text(encoding="utf-8", errors="replace")
    if url.startswith("https://") and use_blob():
        from vercel.blob import sync as blob

        try:
            return blob.get_blob(url, access="public").body.decode("utf-8", errors="replace")
        except Exception:  # noqa: BLE001 — missing object reads as "no file"
            return None
    return None


def delete(url: str) -> None:
    if not url:
        return
    path = _local_path(url)
    if path is not None:
        if path.is_file():
            path.unlink()
        return
    if url.startswith("https://") and use_blob():
        from vercel.blob import sync as blob

        blob.delete_blob(url)
