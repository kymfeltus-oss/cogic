from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_APP_DIR = Path(__file__).resolve().parent
_BACKEND_DIR = _APP_DIR.parent
_ROOT_DIR = _BACKEND_DIR.parent

_env_files: list[str] = []
_root_env = _ROOT_DIR / ".env.local"
if _root_env.is_file():
    _env_files.append(str(_root_env))
_backend_env = _BACKEND_DIR / ".env"
if _backend_env.is_file():
    _env_files.append(str(_backend_env))


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=tuple(_env_files) if _env_files else None,
        extra="ignore",
    )

    redis_url: str = "redis://127.0.0.1:6379/0"
    audio_service_token: str = "dev-audio-token"
    x32_ip: str = ""
    x32_osc_port: int = 10023
    meter_refresh_ms: int = 100
    listen_port: int = 10024
    default_tenant_id: str = "300-awakening"


settings = Settings()
