from __future__ import annotations

import logging
import sys
import types
from unittest.mock import MagicMock
from unittest.mock import patch

from secureship import sms


def test_send_twilio_logs_code_when_enabled(caplog, capsys) -> None:
    """Twilio path should include OTP in logs only when explicit logging is enabled."""
    fake_client = MagicMock()
    fake_messages = MagicMock()
    fake_client.messages = fake_messages
    fake_messages.create = MagicMock()

    fake_rest = types.ModuleType("twilio.rest")
    setattr(fake_rest, "Client", MagicMock(return_value=fake_client))
    fake_twilio = types.ModuleType("twilio")
    setattr(fake_twilio, "rest", fake_rest)

    original_flag = sms.settings.sms_log_verification_code
    original_sid = sms.settings.twilio_account_sid
    original_token = sms.settings.twilio_auth_token
    original_from = sms.settings.twilio_phone_number

    sms.settings.sms_log_verification_code = True
    sms.settings.twilio_account_sid = "sid"
    sms.settings.twilio_auth_token = "token"
    sms.settings.twilio_phone_number = "+14155550000"

    try:
        with caplog.at_level(logging.INFO), patch.dict(
            sys.modules, {"twilio": fake_twilio, "twilio.rest": fake_rest}
        ):
            sms._send_twilio("+14155550123", "123456")

        assert "code=123456" in caplog.text
        assert "code=123456" in capsys.readouterr().out
    finally:
        sms.settings.sms_log_verification_code = original_flag
        sms.settings.twilio_account_sid = original_sid
        sms.settings.twilio_auth_token = original_token
        sms.settings.twilio_phone_number = original_from


def test_send_twilio_redacts_code_when_disabled(caplog) -> None:
    """Twilio path should redact OTP when logging is disabled."""
    fake_client = MagicMock()
    fake_messages = MagicMock()
    fake_client.messages = fake_messages
    fake_messages.create = MagicMock()

    fake_rest = types.ModuleType("twilio.rest")
    setattr(fake_rest, "Client", MagicMock(return_value=fake_client))
    fake_twilio = types.ModuleType("twilio")
    setattr(fake_twilio, "rest", fake_rest)

    original_flag = sms.settings.sms_log_verification_code
    original_sid = sms.settings.twilio_account_sid
    original_token = sms.settings.twilio_auth_token
    original_from = sms.settings.twilio_phone_number

    sms.settings.sms_log_verification_code = False
    sms.settings.twilio_account_sid = "sid"
    sms.settings.twilio_auth_token = "token"
    sms.settings.twilio_phone_number = "+14155550000"

    try:
        with caplog.at_level(logging.INFO), patch.dict(
            sys.modules, {"twilio": fake_twilio, "twilio.rest": fake_rest}
        ):
            sms._send_twilio("+14155550123", "654321")

        assert "code=<redacted>" in caplog.text
        assert "654321" not in caplog.text
    finally:
        sms.settings.sms_log_verification_code = original_flag
        sms.settings.twilio_account_sid = original_sid
        sms.settings.twilio_auth_token = original_token
        sms.settings.twilio_phone_number = original_from


def test_send_mock_logs_code_when_enabled(caplog) -> None:
    """Mock path should include OTP in logs when explicit logging is enabled."""
    original_flag = sms.settings.sms_log_verification_code
    original_debug = sms.settings.debug

    sms.settings.sms_log_verification_code = True
    sms.settings.debug = False

    try:
        with caplog.at_level(logging.INFO):
            sms._send_mock("+14155550123", "112233")

        assert "code=112233" in caplog.text
    finally:
        sms.settings.sms_log_verification_code = original_flag
        sms.settings.debug = original_debug
