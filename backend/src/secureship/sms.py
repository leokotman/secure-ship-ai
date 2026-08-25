"""SMS verification code generation and delivery.

Default: mock (console log). Real Twilio is used when TWILIO_ACCOUNT_SID is set in .env.
"""

import logging
import secrets
import time

from .config import settings

logger = logging.getLogger(__name__)

CODE_LENGTH = 6
CODE_EXPIRY_MINUTES = 10
MAX_CODE_ATTEMPTS = 3


def generate_code() -> str:
    """Generate a cryptographically secure 6-digit numeric code."""
    return "".join(secrets.choice("0123456789") for _ in range(CODE_LENGTH))


def send_sms(phone: str, code: str) -> None:
    """Dispatch SMS to Twilio if configured; otherwise log to console."""
    if settings.twilio_account_sid and settings.twilio_auth_token:
        _send_twilio(phone, code)
    else:
        _send_mock(phone, code)


def _send_mock(phone: str, code: str) -> None:
    reveal_code = settings.sms_log_verification_code or settings.debug
    if reveal_code:
        logger.info("SMS [MOCK] -> %s  code=%s", phone, code)
        # Local-only helper for manual testing when explicit logging is enabled.
        print(f"\n{'='*50}")
        print(f"  SMS [MOCK] -> {phone}")
        print(f"  SecureShip code: {code}  (expires in {CODE_EXPIRY_MINUTES} min)")
        print(f"{'='*50}\n", flush=True)
    else:
        logger.info("SMS [MOCK] -> %s  code=<redacted>", phone)


def _send_twilio(phone: str, code: str) -> None:
    try:
        from twilio.rest import Client  # type: ignore[import-not-found,import-untyped]
    except ImportError:
        logger.warning("twilio package not installed — falling back to mock SMS")
        _send_mock(phone, code)
        return

    delay = 0.5
    attempts = max(1, settings.twilio_max_retries)
    last_exc: Exception | None = None

    for attempt in range(attempts):
        try:
            client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
            client.messages.create(
                body=(
                    f"Your SecureShip verification code is {code}. "
                    f"It expires in {CODE_EXPIRY_MINUTES} minutes."
                ),
                from_=settings.twilio_phone_number,
                to=phone,
            )
            if settings.sms_log_verification_code or settings.debug:
                logger.info("SMS [Twilio] -> %s  sent code=%s", phone, code)
                print(f"SMS [Twilio] -> {phone}  code={code}", flush=True)
            else:
                logger.info("SMS [Twilio] -> %s  sent code=<redacted>", phone)
            return
        except Exception as exc:  # Twilio raises assorted API/connection errors
            last_exc = exc
            # Fail fast on auth errors (do not retry)
            msg = str(exc).lower()
            if "authenticate" in msg or "401" in msg or "unauthorized" in msg:
                logger.error("Twilio auth failure — not retrying: %s", exc)
                raise
            if attempt + 1 >= attempts:
                break
            logger.warning(
                "Transient Twilio error (attempt %d/%d): %s",
                attempt + 1,
                attempts,
                exc,
            )
            time.sleep(delay)
            delay *= 2

    logger.error("Twilio SMS failed after retries: %s", last_exc)
    if last_exc is not None:
        raise last_exc
