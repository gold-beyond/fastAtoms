import os

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Application
    app_name: str = "FastAPI Modular Template"
    debug: bool = False
    version: str = "1.0.0"

    # Server
    host: str = "0.0.0.0"
    port: int = 8000

    # Database
    database_url: str = ""

    # AWS Lambda Configuration
    is_lambda: bool = False
    lambda_function_name: str = "fastapi-backend"
    aws_region: str = "us-east-1"

    # JWT
    jwt_secret_key: str = ""
    jwt_expire_minutes: int = 60
    jwt_algorithm: str = "HS256"

    # OIDC
    oidc_issuer_url: str = ""
    oidc_client_id: str = ""
    oidc_scope: str = "openid profile email"
    frontend_url: str = "http://localhost:3000"

    # Admin
    admin_user_id: str = ""
    admin_user_email: str = ""

    # AI Provider API Keys
    deepseek_api_key: str = ""
    openai_api_key: str = ""
    anthropic_api_key: str = ""

    @property
    def backend_url(self) -> str:
        """Generate backend URL from host and port."""
        if self.is_lambda:
            return os.environ.get(
                "PYTHON_BACKEND_URL", f"https://{self.lambda_function_name}.execute-api.{self.aws_region}.amazonaws.com"
            )
        else:
            display_host = "127.0.0.1" if self.host == "0.0.0.0" else self.host
            return os.environ.get("PYTHON_BACKEND_URL", f"http://{display_host}:{self.port}")

    class Config:
        case_sensitive = False
        extra = "ignore"
        env_file = ".env"
        env_file_encoding = "utf-8"


# Global settings instance
settings = Settings()
