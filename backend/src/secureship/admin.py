"""Admin API endpoints for shipment and package management.

All routes in this module are gated by Auth0 JWT verification via the
require_admin() dependency. This is a separate trust boundary from the
customer-facing session.customer_id gate used in tools.py.
"""

import logging
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi import status as http_status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from .auth import require_admin
from .database import AsyncSessionLocal
from .models import Customer, Package, Shipment

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])


# ── Pydantic Schemas ──────────────────────────────────────────────────────────


ShipmentStatus = Literal[
    "label_created",
    "in_transit",
    "out_for_delivery",
    "delivered",
    "exception",
]


class PackageResponse(BaseModel):
    """Package detail response."""

    id: str
    shipment_id: str
    description: str
    weight_kg: str
    declared_value: str

    class Config:
        from_attributes = True


class ShipmentResponse(BaseModel):
    """Shipment detail response."""

    id: str
    customer_id: str
    tracking_number: str
    status: ShipmentStatus
    carrier: str
    origin: str
    destination: str
    estimated_delivery: str | None
    last_update: str
    deleted_at: str | None
    packages: list[PackageResponse] = []

    class Config:
        from_attributes = True


class ShipmentListResponse(BaseModel):
    """Paginated shipment list response."""

    shipments: list[ShipmentResponse]
    total: int
    page: int
    page_size: int


class CreateShipmentRequest(BaseModel):
    """Request to create a new shipment."""

    customer_id: str = Field(..., description="Customer UUID (must exist in database)")
    tracking_number: str = Field(..., min_length=1, max_length=100, description="Unique tracking number")
    status: ShipmentStatus = Field(default="label_created", description="Initial shipment status")
    carrier: str = Field(..., min_length=1, max_length=100, description="Carrier name (e.g., FedEx, UPS, USPS)")
    origin: str = Field(..., min_length=1, max_length=255, description="Origin location")
    destination: str = Field(..., min_length=1, max_length=255, description="Destination location")
    estimated_delivery: str | None = Field(
        default=None, description="Estimated delivery datetime (ISO 8601 format, e.g., 2026-08-25T12:00:00Z)"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "customer_id": "615bbe4a-2716-4322-8006-b5e2d759689f",
                "tracking_number": "TEST-SWAGGER-001",
                "status": "label_created",
                "carrier": "FedEx",
                "origin": "New York, NY",
                "destination": "Los Angeles, CA",
                "estimated_delivery": "2026-08-30T14:00:00Z"
            }
        }


class UpdateShipmentRequest(BaseModel):
    """Request to update an existing shipment.

    All fields are optional - only send the fields you want to update.
    Example: To update only status, send: {"status": "in_transit"}
    """

    status: ShipmentStatus | None = Field(default=None, description="Update shipment status")
    carrier: str | None = Field(default=None, min_length=1, max_length=100, description="Update carrier name")
    origin: str | None = Field(default=None, min_length=1, max_length=255, description="Update origin location")
    destination: str | None = Field(default=None, min_length=1, max_length=255, description="Update destination location")
    estimated_delivery: str | None = Field(
        default=None, description="Update estimated delivery (ISO 8601 format, e.g., 2026-08-25T12:00:00Z)"
    )

    class Config:
        json_schema_extra = {
            "examples": [
                {"status": "in_transit"},
                {"status": "delivered", "estimated_delivery": "2026-08-25T14:00:00Z"},
                {"carrier": "FedEx", "origin": "New York, NY", "destination": "Los Angeles, CA"}
            ]
        }


class CreatePackageRequest(BaseModel):
    """Request to add a package to a shipment."""

    shipment_id: str = Field(..., description="Shipment UUID")
    description: str = Field(..., min_length=1, max_length=255)
    weight_kg: float = Field(..., gt=0, le=999999.99)
    declared_value: float = Field(..., gt=0, le=999999.99)


class DashboardStatsResponse(BaseModel):
    """Admin dashboard summary statistics."""

    total_shipments: int
    by_status: dict[str, int]
    recent_shipments: list[ShipmentResponse]


# ── Helper Functions ──────────────────────────────────────────────────────────


def _shipment_to_response(shipment: Shipment) -> ShipmentResponse:
    """Convert Shipment ORM to ShipmentResponse."""
    return ShipmentResponse(
        id=str(shipment.id),
        customer_id=str(shipment.customer_id),
        tracking_number=shipment.tracking_number,
        status=shipment.status,  # type: ignore
        carrier=shipment.carrier,
        origin=shipment.origin,
        destination=shipment.destination,
        estimated_delivery=(
            shipment.estimated_delivery.isoformat()
            if shipment.estimated_delivery
            else None
        ),
        last_update=shipment.last_update.isoformat() if shipment.last_update else "",
        deleted_at=shipment.deleted_at.isoformat() if shipment.deleted_at else None,
        packages=[
            PackageResponse(
                id=str(p.id),
                shipment_id=str(p.shipment_id),
                description=p.description,
                weight_kg=str(p.weight_kg),
                declared_value=str(p.declared_value),
            )
            for p in shipment.packages
        ],
    )


# ── Shipment Endpoints ────────────────────────────────────────────────────────


@router.get("/shipments", response_model=ShipmentListResponse)
async def list_shipments(
    status: ShipmentStatus | None = Query(default=None, description="Filter by status"),
    customer_id: str | None = Query(
        default=None, description="Filter by customer UUID"
    ),
    tracking_number: str | None = Query(
        default=None, description="Filter by tracking number"
    ),
    include_deleted: bool = Query(
        default=False, description="Include soft-deleted shipments"
    ),
    page: int = Query(default=1, ge=1, description="Page number"),
    page_size: int = Query(default=50, ge=1, le=100, description="Items per page"),
    _admin: dict[str, Any] = Depends(require_admin),
) -> ShipmentListResponse:
    """List all shipments with optional filters and pagination.

    Admin-only endpoint — gated by Auth0 JWT verification.
    """
    async with AsyncSessionLocal() as db:
        # Build base query
        query = select(Shipment)

        # Apply filters
        if status:
            query = query.where(Shipment.status == status)
        if customer_id:
            try:
                customer_uuid = uuid.UUID(customer_id)
                query = query.where(Shipment.customer_id == customer_uuid)
            except ValueError:
                raise HTTPException(
                    status_code=http_status.HTTP_400_BAD_REQUEST,
                    detail="Invalid customer_id format",
                )
        if tracking_number:
            query = query.where(Shipment.tracking_number == tracking_number)
        if not include_deleted:
            query = query.where(Shipment.deleted_at.is_(None))

        # Count total matching shipments
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0

        # Apply pagination
        query = query.order_by(Shipment.last_update.desc())
        query = query.offset((page - 1) * page_size).limit(page_size)

        # Execute query
        result = await db.execute(query)
        shipments = result.scalars().all()

        # Load packages for each shipment
        response_list: list[ShipmentResponse] = []
        for s in shipments:
            await db.refresh(s, attribute_names=["packages"])
            response_list.append(_shipment_to_response(s))

        return ShipmentListResponse(
            shipments=response_list,
            total=total,
            page=page,
            page_size=page_size,
        )


@router.post(
    "/shipments",
    response_model=ShipmentResponse,
    status_code=http_status.HTTP_201_CREATED,
)
async def create_shipment(
    request: CreateShipmentRequest,
    _admin: dict[str, Any] = Depends(require_admin),
) -> ShipmentResponse:
    """Create a new shipment.

    Validates that customer_id exists before creating the shipment.
    Admin-only endpoint — gated by Auth0 JWT verification.
    """
    try:
        customer_uuid = uuid.UUID(request.customer_id)
    except ValueError:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="Invalid customer_id format",
        )

    # Parse estimated_delivery if provided
    estimated_delivery_dt: datetime | None = None
    if request.estimated_delivery:
        try:
            estimated_delivery_dt = datetime.fromisoformat(request.estimated_delivery)
        except ValueError:
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail="Invalid estimated_delivery format (expected ISO 8601)",
            )

    async with AsyncSessionLocal() as db:
        # Verify customer exists
        customer_result = await db.execute(
            select(Customer).where(Customer.id == customer_uuid)
        )
        customer = customer_result.scalar_one_or_none()
        if not customer:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail=f"Customer {request.customer_id} not found",
            )

        # Create shipment
        new_shipment = Shipment(
            id=uuid.uuid4(),
            customer_id=customer_uuid,
            tracking_number=request.tracking_number,
            status=request.status,
            carrier=request.carrier,
            origin=request.origin,
            destination=request.destination,
            estimated_delivery=estimated_delivery_dt,
            last_update=datetime.now(timezone.utc),
        )

        try:
            db.add(new_shipment)
            await db.commit()
            await db.refresh(new_shipment, attribute_names=["packages"])
        except IntegrityError as e:
            await db.rollback()
            logger.error("Failed to create shipment: %s", e)
            raise HTTPException(
                status_code=http_status.HTTP_409_CONFLICT,
                detail="Tracking number already exists",
            )

        return _shipment_to_response(new_shipment)


@router.put("/shipments/{shipment_id}", response_model=ShipmentResponse)
async def update_shipment(
    shipment_id: str,
    request: UpdateShipmentRequest,
    _admin: dict[str, Any] = Depends(require_admin),
) -> ShipmentResponse:
    """Update an existing shipment's status, carrier, origin, destination, or estimated_delivery.

    Admin-only endpoint — gated by Auth0 JWT verification.
    """
    try:
        shipment_uuid = uuid.UUID(shipment_id)
    except ValueError:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="Invalid shipment_id format",
        )

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Shipment).where(Shipment.id == shipment_uuid))
        shipment = result.scalar_one_or_none()

        if not shipment:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail=f"Shipment {shipment_id} not found",
            )

        # Apply updates
        updated = False
        if request.status is not None:
            shipment.status = request.status
            updated = True
        if request.carrier is not None:
            shipment.carrier = request.carrier
            updated = True
        if request.origin is not None:
            shipment.origin = request.origin
            updated = True
        if request.destination is not None:
            shipment.destination = request.destination
            updated = True
        if request.estimated_delivery is not None:
            try:
                shipment.estimated_delivery = datetime.fromisoformat(
                    request.estimated_delivery
                )
                updated = True
            except ValueError:
                raise HTTPException(
                    status_code=http_status.HTTP_400_BAD_REQUEST,
                    detail="Invalid estimated_delivery format (expected ISO 8601)",
                )

        if updated:
            shipment.last_update = datetime.now(timezone.utc)
            await db.commit()
            await db.refresh(shipment, attribute_names=["packages"])

        return _shipment_to_response(shipment)


@router.delete("/shipments/{shipment_id}", status_code=http_status.HTTP_204_NO_CONTENT)
async def delete_shipment(
    shipment_id: str,
    _admin: dict[str, Any] = Depends(require_admin),
) -> None:
    """Soft-delete a shipment by setting deleted_at timestamp.

    The row remains in the database but is filtered out from all customer-facing
    queries in tools.py. Admin endpoints can still see it with include_deleted=true.

    Admin-only endpoint — gated by Auth0 JWT verification.
    """
    try:
        shipment_uuid = uuid.UUID(shipment_id)
    except ValueError:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="Invalid shipment_id format",
        )

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Shipment).where(Shipment.id == shipment_uuid))
        shipment = result.scalar_one_or_none()

        if not shipment:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail=f"Shipment {shipment_id} not found",
            )

        # Soft delete
        shipment.deleted_at = datetime.now(timezone.utc)
        shipment.last_update = datetime.now(timezone.utc)
        await db.commit()


# ── Package Endpoints ─────────────────────────────────────────────────────────


@router.post(
    "/packages",
    response_model=PackageResponse,
    status_code=http_status.HTTP_201_CREATED,
)
async def create_package(
    request: CreatePackageRequest,
    _admin: dict[str, Any] = Depends(require_admin),
) -> PackageResponse:
    """Add a package to an existing shipment.

    Admin-only endpoint — gated by Auth0 JWT verification.
    """
    try:
        shipment_uuid = uuid.UUID(request.shipment_id)
    except ValueError:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="Invalid shipment_id format",
        )

    async with AsyncSessionLocal() as db:
        # Verify shipment exists
        shipment_result = await db.execute(
            select(Shipment).where(Shipment.id == shipment_uuid)
        )
        shipment = shipment_result.scalar_one_or_none()
        if not shipment:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail=f"Shipment {request.shipment_id} not found",
            )

        # Create package
        new_package = Package(
            id=uuid.uuid4(),
            shipment_id=shipment_uuid,
            description=request.description,
            weight_kg=Decimal(str(request.weight_kg)),
            declared_value=Decimal(str(request.declared_value)),
        )

        db.add(new_package)
        await db.commit()
        await db.refresh(new_package)

        return PackageResponse(
            id=str(new_package.id),
            shipment_id=str(new_package.shipment_id),
            description=new_package.description,
            weight_kg=str(new_package.weight_kg),
            declared_value=str(new_package.declared_value),
        )


# ── Dashboard Endpoint ────────────────────────────────────────────────────────


@router.get("/dashboard", response_model=DashboardStatsResponse)
async def get_dashboard(
    _admin: dict[str, Any] = Depends(require_admin),
) -> DashboardStatsResponse:
    """Get admin dashboard summary statistics.

    Returns:
    - Total shipment count (excluding soft-deleted)
    - Count by status
    - 10 most recent shipments

    Admin-only endpoint — gated by Auth0 JWT verification.
    """
    async with AsyncSessionLocal() as db:
        # Total shipments (excluding soft-deleted)
        total_result = await db.execute(
            select(func.count(Shipment.id)).where(Shipment.deleted_at.is_(None))
        )
        total = total_result.scalar() or 0

        # Count by status (excluding soft-deleted)
        by_status: dict[str, int] = {}
        status_result = await db.execute(
            select(Shipment.status, func.count(Shipment.id))
            .where(Shipment.deleted_at.is_(None))
            .group_by(Shipment.status)
        )
        for status_value, count in status_result.all():
            by_status[status_value] = count

        # Recent shipments (last 10, excluding soft-deleted)
        recent_result = await db.execute(
            select(Shipment)
            .where(Shipment.deleted_at.is_(None))
            .order_by(Shipment.last_update.desc())
            .limit(10)
        )
        recent_shipments = recent_result.scalars().all()

        recent_list: list[ShipmentResponse] = []
        for s in recent_shipments:
            await db.refresh(s, attribute_names=["packages"])
            recent_list.append(_shipment_to_response(s))

        return DashboardStatsResponse(
            total_shipments=total,
            by_status=by_status,
            recent_shipments=recent_list,
        )


# ── Auth0 Login/Callback ────


@router.get("/login")
async def admin_login() -> dict[str, str]:
    """Redirect to Auth0 Universal Login.

    In a production deployment, this would construct the Auth0 authorization URL
    with proper redirect_uri, client_id, audience, scope, and state parameters,
    then return a redirect response.

    For this implementation, we return a placeholder indicating where the redirect
    would point. The actual OAuth2 flow integration (with redirect handling) is
    typically implemented in the frontend or a BFF layer.
    """
    # Placeholder: in a real implementation, you would redirect to:
    # https://{AUTH0_DOMAIN}/authorize?response_type=code&client_id=...&redirect_uri=...&audience=...&scope=openid profile email
    return {
        "message": "Redirect to Auth0 Universal Login",
        "note": "In production, this endpoint would redirect to Auth0 authorization URL",
    }


@router.get("/callback")
async def admin_callback(
    code: str | None = Query(default=None, description="Authorization code from Auth0"),
) -> dict[str, str]:
    """Handle Auth0 callback and exchange code for tokens.

    In a production deployment, this would:
    1. Validate the code parameter
    2. Exchange it for an access token via Auth0's /oauth/token endpoint
    3. Set a secure session cookie or return the token to the frontend
    4. Redirect to the admin dashboard

    For this implementation, we return a placeholder response.
    """
    if not code:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="Missing authorization code",
        )

    # Placeholder: in a real implementation, you would:
    # 1. POST to https://{AUTH0_DOMAIN}/oauth/token with code, client_id, client_secret,
    #  redirect_uri
    # 2. Get access_token, id_token, refresh_token
    # 3. Set secure HTTP-only cookie or return token to frontend
    return {
        "message": "Auth0 callback received",
        "code": code[:10] + "...",  # truncated for security
        "note": "In production, this would exchange the code for tokens and set session",
    }
