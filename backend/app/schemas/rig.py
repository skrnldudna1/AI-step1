from typing import Literal

from pydantic import BaseModel, Field, model_validator
from app.schemas.ai import Emotion


PartId = Literal[
    "head", "torso", "left_eye", "right_eye", "left_eyebrow", "right_eyebrow",
    "nose", "mouth", "hair", "left_arm", "right_arm", "left_leg", "right_leg",
    "tail", "accessory",
]


class RegionPoint(BaseModel):
    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)


class RigRegion(BaseModel):
    id: PartId
    points: list[RegionPoint] = Field(min_length=3, max_length=32)
    pivot: RegionPoint
    mode: Literal["region", "detail"] = "region"

    @model_validator(mode="after")
    def valid_area(self):
        area = abs(sum(
            p.x * q.y - q.x * p.y
            for p, q in zip(self.points, self.points[1:] + self.points[:1])
        )) / 2
        if area < 0.000001:
            raise ValueError("분리 영역의 넓이가 너무 작습니다.")
        return self


class ExpressionLayout(BaseModel):
    emotion: Emotion
    regions: list[RigRegion] = Field(default_factory=list, max_length=15)
