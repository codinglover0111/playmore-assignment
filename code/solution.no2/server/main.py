"""임시토큰 생성 서버

임시토큰 생성 서버는 토큰 생성 요청을 받아 토큰을 생성하고 토큰 이름을 반환하는 서버입니다.
"""

import datetime
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from google import genai
from dotenv import load_dotenv

load_dotenv()

USE_NUM = 1  # 토큰 사용횟수
EXPIRE_TIME = 30  # 토큰 만료시간(분)
SESSION_EXPIRE_TIME = 1  # 세션 만료시간(분)


@asynccontextmanager
async def lifespan(_: FastAPI):
    """
    앱 시작 시 필수 환경 변수 확인
    """
    if not os.environ.get("GOOGLE_API_KEY"):
        raise RuntimeError("환경 변수 GOOGLE_API_KEY 가 설정되어 있지 않습니다.")
    yield


app = FastAPI(lifespan=lifespan)


@app.get("/token")
def get_token():
    """
    토큰 생성
    TODO: 인증된 사용자만 토큰 생성 가능하도록 수정

    Returns:
        token: 토큰 이름
    """
    now = datetime.datetime.now(tz=datetime.timezone.utc)
    try:
        client = genai.Client(
            http_options={
                "api_version": "v1alpha",  # v1 알파만 임시 토큰을 생성할 수 있음
            }
        )

        token = client.auth_tokens.create(
            config={
                "uses": USE_NUM,
                "expire_time": now + datetime.timedelta(minutes=EXPIRE_TIME),
                "new_session_expire_time": now
                + datetime.timedelta(minutes=SESSION_EXPIRE_TIME),
                "http_options": {"api_version": "v1alpha"},
            }
        )
        return {"status_code": 200, "message": "success", "token": token.name}
    except ValueError:
        return {"status_code": 200, "message": "error", "token": "error"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", reload=True)
