from pydantic import BaseModel, ConfigDict, Field


class TenantBase(BaseModel):
    name: str = Field(..., min_length=3)
    domain: str | None = None


class TenantCreate(TenantBase):
    id: str


class TenantRead(TenantBase):
    id: str

    model_config = ConfigDict(from_attributes=True)
