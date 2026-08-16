from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import URL


class Configuracion(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=("../../.env", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    nombre_aplicacion: str = Field("TaiLil ERP", validation_alias="APP_NAME")
    ambiente: str = Field("development", validation_alias="APP_ENV")
    modo_debug: bool = Field(True, validation_alias="APP_DEBUG")

    postgres_host: str = Field("localhost", validation_alias="POSTGRES_HOST")
    postgres_puerto: int = Field(5432, validation_alias="POSTGRES_PORT")
    postgres_base: str = Field("TaiLil_ERP", validation_alias="POSTGRES_DB")
    postgres_usuario: str = Field("postgres", validation_alias="POSTGRES_USER")
    postgres_contrasena: str = Field("", validation_alias="POSTGRES_PASSWORD")

    jwt_algoritmo: str = Field("HS256", validation_alias="JWT_ALGORITHM")
    jwt_secreto_acceso: str = Field("", validation_alias="JWT_ACCESS_SECRET")
    jwt_secreto_refresco: str = Field("", validation_alias="JWT_REFRESH_SECRET")
    jwt_acceso_minutos: int = Field(15, validation_alias="JWT_ACCESS_EXPIRE_MINUTES")
    jwt_refresco_dias: int = Field(7, validation_alias="JWT_REFRESH_EXPIRE_DAYS")
    cookie_acceso: str = Field("tailil_access_token", validation_alias="JWT_ACCESS_COOKIE_NAME")
    cookie_refresco: str = Field("tailil_refresh_token", validation_alias="JWT_REFRESH_COOKIE_NAME")
    cookie_segura: bool = Field(False, validation_alias="COOKIE_SECURE")
    cookie_samesite: str = Field("lax", validation_alias="COOKIE_SAMESITE")

    administrador_inicial_usuario: str = Field("admin", validation_alias="INITIAL_ADMIN_USERNAME")
    administrador_inicial_contrasena: str = Field("", validation_alias="INITIAL_ADMIN_PASSWORD")

    origenes_cors_texto: str = Field("http://localhost:3000", validation_alias="CORS_ORIGINS")

    @property
    def origenes_cors(self) -> list[str]:
        return [origen.strip() for origen in self.origenes_cors_texto.split(",") if origen.strip()]

    @property
    def url_base_datos(self) -> URL:
        return URL.create(
            drivername="postgresql+asyncpg",
            username=self.postgres_usuario,
            password=self.postgres_contrasena,
            host=self.postgres_host,
            port=self.postgres_puerto,
            database=self.postgres_base,
        )


@lru_cache
def obtener_configuracion() -> Configuracion:
    return Configuracion()


configuracion = obtener_configuracion()
