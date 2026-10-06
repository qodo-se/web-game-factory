"""Never silently overwrite a published, year-cached map URL."""
from pathlib import Path


def write_immutable(path, content):
    path = Path(path)
    data = content.encode('utf-8') if isinstance(content, str) else content
    if path.exists():
        if path.read_bytes() != data:
            raise ValueError(f'{path.name} already exists with different content. Publish a new asset version.')
        return
    path.write_bytes(data)
