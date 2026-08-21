"""Seed script for local SecureShip development data."""

import asyncio
import os
import random
import uuid
from datetime import datetime, timedelta, timezone

import asyncpg

CUSTOMER_COUNT = 25
MIN_SHIPMENTS = 40
MAX_SHIPMENTS = 60

FIRST_NAMES = [
    "Liam",
    "Olivia",
    "Noah",
    "Emma",
    "Oliver",
    "Ava",
    "Elijah",
    "Sophia",
    "Mateo",
    "Mia",
    "Lucas",
    "Amelia",
    "Ethan",
    "Harper",
    "Logan",
    "Evelyn",
    "Aiden",
    "Abigail",
    "James",
    "Emily",
    "Henry",
    "Ella",
    "Benjamin",
    "Scarlett",
    "Jackson",
]

LAST_NAMES = [
    "Smith",
    "Johnson",
    "Williams",
    "Brown",
    "Jones",
    "Garcia",
    "Miller",
    "Davis",
    "Rodriguez",
    "Martinez",
    "Hernandez",
    "Lopez",
    "Gonzalez",
    "Wilson",
    "Anderson",
    "Thomas",
    "Taylor",
    "Moore",
    "Jackson",
    "Martin",
    "Lee",
    "Perez",
    "Thompson",
    "White",
    "Harris",
]

CARRIERS = ["UPS", "FedEx", "USPS", "DHL"]
CITIES = [
    "New York, NY",
    "Austin, TX",
    "Seattle, WA",
    "San Diego, CA",
    "Chicago, IL",
    "Boston, MA",
    "Denver, CO",
    "Atlanta, GA",
]

STATUSES = [
    "label_created",
    "in_transit",
    "out_for_delivery",
    "delivered",
    "exception",
]

PACKAGE_ITEMS = [
    "Electronics",
    "Books",
    "Clothing",
    "Home Goods",
    "Supplements",
    "Toys",
    "Office Supplies",
    "Sporting Goods",
]


def _database_url() -> str:
    raw = os.environ.get(
        "DATABASE_URL",
        "postgresql+asyncpg://postgres:postgres@localhost:5432/secureship",
    )
    return raw.replace("postgresql+asyncpg://", "postgresql://", 1)


async def create_schema(conn: asyncpg.Connection) -> None:
    await conn.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shipment_status') THEN
                CREATE TYPE shipment_status AS ENUM (
                    'label_created',
                    'in_transit',
                    'out_for_delivery',
                    'delivered',
                    'exception'
                );
            END IF;
        END
        $$;
        """)

    await conn.execute("""
        CREATE TABLE IF NOT EXISTS customers (
            id UUID PRIMARY KEY,
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            phone_number TEXT NOT NULL UNIQUE,
            address TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS shipments (
            id UUID PRIMARY KEY,
            customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
            tracking_number TEXT NOT NULL UNIQUE,
            status shipment_status NOT NULL,
            carrier TEXT NOT NULL,
            origin TEXT NOT NULL,
            destination TEXT NOT NULL,
            estimated_delivery TIMESTAMPTZ,
            last_update TIMESTAMPTZ NOT NULL
        );

        CREATE TABLE IF NOT EXISTS packages (
            id UUID PRIMARY KEY,
            shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
            description TEXT NOT NULL,
            weight_kg NUMERIC(10, 2) NOT NULL,
            declared_value NUMERIC(10, 2) NOT NULL
        );
        """)


def generate_customers() -> list[tuple[uuid.UUID, str, str, str, str]]:
    customers: list[tuple[uuid.UUID, str, str, str, str]] = []
    for idx in range(CUSTOMER_COUNT):
        customer_id = uuid.uuid4()
        first_name = FIRST_NAMES[idx]
        last_name = LAST_NAMES[idx]
        phone_number = f"+1415555{idx:04d}"
        address = f"{100 + idx} Market St, Apt {idx + 1}"
        customers.append((customer_id, first_name, last_name, phone_number, address))
    return customers


def generate_shipments(
    customers: list[tuple[uuid.UUID, str, str, str, str]],
) -> list[tuple[uuid.UUID, uuid.UUID, str, str, str, str, str, datetime, datetime]]:
    shipment_count = random.randint(MIN_SHIPMENTS, MAX_SHIPMENTS)
    now = datetime.now(timezone.utc)

    shipments: list[
        tuple[uuid.UUID, uuid.UUID, str, str, str, str, str, datetime, datetime]
    ] = []
    for idx in range(shipment_count):
        shipment_id = uuid.uuid4()
        customer_id = random.choice(customers)[0]
        tracking_number = f"SS{now:%y%m}{idx:06d}"
        status = random.choice(STATUSES)
        carrier = random.choice(CARRIERS)
        origin = random.choice(CITIES)
        destination = random.choice(CITIES)
        eta = now + timedelta(days=random.randint(1, 10))
        last_update = now - timedelta(hours=random.randint(0, 72))

        shipments.append(
            (
                shipment_id,
                customer_id,
                tracking_number,
                status,
                carrier,
                origin,
                destination,
                eta,
                last_update,
            )
        )
    return shipments


def generate_packages(
    shipments: list[
        tuple[uuid.UUID, uuid.UUID, str, str, str, str, str, datetime, datetime]
    ],
) -> list[tuple[uuid.UUID, uuid.UUID, str, float, float]]:
    packages: list[tuple[uuid.UUID, uuid.UUID, str, float, float]] = []
    for shipment in shipments:
        shipment_id = shipment[0]
        for _ in range(random.randint(1, 3)):
            package_id = uuid.uuid4()
            description = random.choice(PACKAGE_ITEMS)
            weight_kg = round(random.uniform(0.2, 25.0), 2)
            declared_value = round(random.uniform(10.0, 1200.0), 2)
            packages.append(
                (package_id, shipment_id, description, weight_kg, declared_value)
            )
    return packages


async def seed() -> None:
    random.seed(42)
    conn = await asyncpg.connect(_database_url())
    try:
        await conn.execute(
            "TRUNCATE TABLE packages, shipments, customers RESTART IDENTITY CASCADE"
        )

        customers = generate_customers()
        shipments = generate_shipments(customers)
        packages = generate_packages(shipments)

        await conn.executemany(
            """
            INSERT INTO customers (id, first_name, last_name, phone_number, address)
            VALUES ($1, $2, $3, $4, $5)
            """,
            customers,
        )

        await conn.executemany(
            """
            INSERT INTO shipments (
                id,
                customer_id,
                tracking_number,
                status,
                carrier,
                origin,
                destination,
                estimated_delivery,
                last_update
            )
            VALUES ($1, $2, $3, $4::shipment_status, $5, $6, $7, $8, $9)
            """,
            shipments,
        )

        await conn.executemany(
            """
            INSERT INTO packages (id, shipment_id, description, weight_kg, declared_value)
            VALUES ($1, $2, $3, $4, $5)
            """,
            packages,
        )

        print(
            f"Seed complete: {len(customers)} customers, "
            f"{len(shipments)} shipments, {len(packages)} packages"
        )
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(seed())
