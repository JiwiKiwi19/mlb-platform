from __future__ import annotations

import pytest

from mlb_pipeline.config import Settings
from mlb_pipeline.kafka import consumer_config, producer_config


def _settings(**overrides: object) -> Settings:
    return Settings(_env_file=None, **overrides)


def test_local_default_is_plaintext_without_credentials():
    conn = _settings(kafka_bootstrap_servers="redpanda:9092").kafka_connection()

    assert conn == {"bootstrap.servers": "redpanda:9092", "security.protocol": "PLAINTEXT"}


def test_sasl_ssl_includes_credentials():
    conn = _settings(
        kafka_bootstrap_servers="broker.cloud.redpanda.com:9092",
        kafka_security_protocol="SASL_SSL",
        kafka_sasl_username="pipeline",
        kafka_sasl_password="s3cret",
    ).kafka_connection()

    assert conn == {
        "bootstrap.servers": "broker.cloud.redpanda.com:9092",
        "security.protocol": "SASL_SSL",
        "sasl.mechanism": "SCRAM-SHA-256",
        "sasl.username": "pipeline",
        "sasl.password": "s3cret",
    }


def test_sasl_without_credentials_fails_fast():
    with pytest.raises(RuntimeError, match="KAFKA_SASL_USERNAME and KAFKA_SASL_PASSWORD"):
        _settings(kafka_security_protocol="SASL_SSL", kafka_sasl_username="pipeline").kafka_connection()


def test_sasl_settings_load_from_environment(monkeypatch):
    monkeypatch.setenv("KAFKA_SECURITY_PROTOCOL", "SASL_SSL")
    monkeypatch.setenv("KAFKA_SASL_MECHANISM", "SCRAM-SHA-512")
    monkeypatch.setenv("KAFKA_SASL_USERNAME", "pipeline")
    monkeypatch.setenv("KAFKA_SASL_PASSWORD", "s3cret")

    conn = _settings().kafka_connection()

    assert conn["sasl.mechanism"] == "SCRAM-SHA-512"
    assert conn["sasl.password"] == "s3cret"


def test_password_is_not_exposed_in_settings_repr():
    settings = _settings(kafka_sasl_password="s3cret")

    assert "s3cret" not in repr(settings)


def test_client_configs_carry_connection_settings():
    conn = {"bootstrap.servers": "b:9092", "security.protocol": "SASL_SSL", "sasl.username": "u"}

    producer = producer_config(conn, "client")
    consumer = consumer_config(conn, "group")

    for cfg in (producer, consumer):
        assert cfg["security.protocol"] == "SASL_SSL"
        assert cfg["sasl.username"] == "u"
    assert producer["enable.idempotence"] is True
    assert consumer["enable.auto.commit"] is False
