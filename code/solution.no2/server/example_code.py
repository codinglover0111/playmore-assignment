import datetime
from google import genai

now = datetime.datetime.now(tz=datetime.timezone.utc)

client = genai.Client(
    http_options={
        "api_version": "v1alpha",
    }
)

token = client.auth_tokens.create(
    config={
        "uses": 1,  # 토큰 사용횟수 1회
        "expire_time": now + datetime.timedelta(minutes=30),  # 토큰 만료시간 30분 후
        "new_session_expire_time": now
        + datetime.timedelta(minutes=1),  # 세션 만료시간 1분 후
        "http_options": {"api_version": "v1alpha"},
    }
)

# 토큰 이름(token.name)을 클라이언트에 전달하여 사용
