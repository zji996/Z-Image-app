from __future__ import annotations

"""
Shared typing helpers for loosely structured payloads exchanged between
the API, worker tasks, and the web client.
"""

from collections.abc import Mapping, Sequence
from typing import TypeAlias, TypedDict


JSONScalar = str | int | float | bool | None
JSONValue: TypeAlias = JSONScalar | Sequence["JSONValue"] | Mapping[str, "JSONValue"]
JSONDict: TypeAlias = dict[str, JSONValue]


class GenerationResult(TypedDict):
    image_id: str
    prompt: str
    height: int
    width: int
    num_inference_steps: int
    guidance_scale: float
    seed: int | None
    negative_prompt: str | None
    cfg_normalization: bool | None
    cfg_truncation: float | None
    max_sequence_length: int | None
    created_at: str
    auth_key: str | None
    metadata: JSONDict
    output_path: str
    relative_path: str


__all__ = [
    "GenerationResult",
    "JSONDict",
    "JSONScalar",
    "JSONValue",
]
