from __future__ import annotations

import logging
import json
import asyncio
from dotenv import load_dotenv

from google.genai.types import Modality
from livekit.agents import (
    Agent,
    AgentSession,
    JobContext,
    WorkerOptions,
    cli,
)
from livekit.plugins import google

load_dotenv()

LOGGER = logging.getLogger("my-worker")
LOGGER.setLevel(logging.INFO)

# 언어별 번역 프롬프트 정의
LANGUAGE_PROMPTS = {
    "en": "한국어로 들리는 모든 내용을 영어로 번역하시오.",
    "ko": "translate to korean",
    "ja": "한국어로 들리는 모든 내용을 일본어로 번역하시오.",
    "zh": "한국어로 들리는 모든 내용을 중국어로 번역하시오.",
    "es": "한국어로 들리는 모든 내용을 스페인어로 번역하시오.",
}

DEFAULT_INSTRUCTIONS = LANGUAGE_PROMPTS["en"]
DEFAULT_MODEL = "gemini-live-2.5-flash-preview"


async def update_language_from_participant(participant, agent_obj: Agent):
    """참여자의 메타데이터에서 언어 설정을 확인하고 업데이트합니다."""
    LOGGER.info(
        "참여자 연결됨: %s, 메타데이터: %s",
        participant.identity,
        participant.metadata,
    )

    if participant.metadata:
        try:
            metadata = json.loads(participant.metadata)
            if "language" in metadata:
                selected_language = metadata["language"]
                user_language = LANGUAGE_PROMPTS.get(
                    selected_language, DEFAULT_INSTRUCTIONS
                )
                LOGGER.info(
                    "언어 설정 감지: %s -> %s", selected_language, user_language
                )
                # 에이전트의 프롬프트 업데이트
                await agent_obj.update_instructions(user_language)
        except json.JSONDecodeError:
            LOGGER.warning("메타데이터 파싱 실패: %s", participant.metadata)


async def entrypoint(ctx: JobContext) -> None:
    """LiveKit 작업 엔트리포인트: 세션을 생성하고 RPC를 등록합니다."""
    # 먼저 연결을 수행해야 참여자 정보를 가져올 수 있습니다
    await ctx.connect()

    # 기본 프롬프트로 에이전트 생성
    session_agent = Agent(
        instructions=DEFAULT_INSTRUCTIONS,
    )

    # 참여자 연결 이벤트를 처리하여 언어 설정 감지
    def on_participant_connected(participant):
        """동기 이벤트 핸들러: async 함수를 태스크로 실행합니다."""
        asyncio.create_task(
            update_language_from_participant(participant, session_agent)
        )

    # 이벤트 핸들러 등록
    ctx.room.on("participant_connected", on_participant_connected)

    # 이미 연결된 참여자가 있는지 확인
    for participant in ctx.room.remote_participants.values():
        await update_language_from_participant(participant, session_agent)

    session = AgentSession(
        llm=google.beta.realtime.RealtimeModel(
            model=DEFAULT_MODEL,
            modalities=[Modality.TEXT],
        ),
    )
    session.output.set_audio_enabled(False)

    await session.start(agent=session_agent, room=ctx.room)


if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            # 엔트리포인트 함수
            entrypoint_fnc=entrypoint,
            # warmup 프로세스 수
            # num_idle_processes=10,
            # 에이전트 이름
            # agent_name="test-agent",
            # 로드 임계값
            # load_threshold=0.7,
        )
    )
