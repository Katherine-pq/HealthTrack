from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import URL


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    postgres_user: str = "postgres"
    postgres_password: str = "postgres"
    postgres_db: str = "wearable_db"
    postgres_host: str = "db"
    postgres_port: int = 5432
    postgres_sslmode: str = "disable"
    app_environment: str = "development"
    public_url: str | None = None

    @property
    def database_url(self) -> URL:
        return URL.create(
            drivername="postgresql+psycopg2",
            username=self.postgres_user,
            password=self.postgres_password,
            host=self.postgres_host,
            port=self.postgres_port,
            database=self.postgres_db,
        )

    @property
    def is_production(self) -> bool:
        return self.app_environment.lower() == "production"

    @property
    def canonical_origin(self) -> str | None:
        return self.public_url.rstrip("/") if self.public_url else None


settings = Settings()
