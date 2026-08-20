"""SMS verification code generation and delivery.

Default: mock (console log). Real Twilio is used when TWILIO_ACCOUNT_SID is set in .env.
"""

import logging
import secrets

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
            # Print to stdout so container logs always show the code in local/dev when enabled.
            print(f"SMS [Twilio] -> {phone}  code={code}", flush=True)
        else:
            logger.info("SMS [Twilio] -> %s  sent code=<redacted>", phone)
    except ImportError:
        logger.warning("twilio package not installed — falling back to mock SMS")
        _send_mock(phone, code)
