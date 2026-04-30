from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import schemas
from app.dependencies import get_current_admin_user, get_db, get_tenant
from app.services.auth import get_organization_by_tenant
from app.services.payment import PaymentService

router = APIRouter()


@router.get("/plans")
def list_plans():
    return [
        {"id": "starter", "name": "Starter", "price": 1999},
        {"id": "growth", "name": "Growth", "price": 4999},
    ]


@router.post("/payment-intents", response_model=schemas.PaymentIntentRead)
def create_payment_intent(
    payload: schemas.PaymentIntentCreate,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin_user),
):
    organization = get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    payment_service = PaymentService()
    try:
        intent = payment_service.create_stripe_payment_intent(
            amount=payload.amount,
            currency=payload.currency,
            metadata={
                "organization_id": str(organization.id),
                "description": payload.description or "",
                **(payload.metadata or {}),
            },
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc

    return schemas.PaymentIntentRead(
        id=intent.id,
        amount=intent.amount,
        currency=intent.currency,
        status=intent.status,
        client_secret=getattr(intent, "client_secret", None),
        metadata=intent.metadata,
    )
