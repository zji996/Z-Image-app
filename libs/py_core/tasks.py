from __future__ import annotations

import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict

from .celery_app import celery_app
from .config import get_output_root
from .z_image_pipeline import generate_image


@celery_app.task(name="z_image.generate_image")
def generate_image_task(
    prompt: str,
    *,
    height: int = 1024,
    width: int = 1024,
    num_inference_steps: int = 9,
    guidance_scale: float = 0.0,
    seed: int | None = None,
    auth_key: str | None = None,
) -> Dict[str, Any]:
    """
    Celery task that runs a Z-Image generation job and saves
    the result to disk with a unique identifier.
    """

    image_id = uuid.uuid4().hex
    now = datetime.now(timezone.utc)

    image = generate_image(
        prompt=prompt,
        height=height,
        width=width,
        num_inference_steps=num_inference_steps,
        guidance_scale=guidance_scale,
        seed=seed,
    )

    output_root = get_output_root()
    dated_dir = output_root / now.strftime("%Y%m%d")
    dated_dir.mkdir(parents=True, exist_ok=True)

    filename = f"{now.strftime('%H%M%S')}_{image_id}.png"
    output_path = dated_dir / filename
    image.save(output_path)

    relative_path = output_path.relative_to(output_root)

    return {
        "image_id": image_id,
        "prompt": prompt,
        "height": height,
        "width": width,
        "num_inference_steps": num_inference_steps,
        "guidance_scale": guidance_scale,
        "seed": seed,
        "created_at": now.isoformat(),
        "auth_key": auth_key,
        "output_path": str(output_path),
        "relative_path": str(relative_path),
    }
