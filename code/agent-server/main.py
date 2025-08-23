from __future__ import annotations

import logging
from dotenv import load_dotenv

from livekit.agents import (
    Agent,
    AgentSession,
    JobContext,
    WorkerOptions,
    cli,
)
from google.genai.types import Modality
from livekit.plugins import google


load_dotenv()
logger = logging.getLogger("my-worker")
logger.setLevel(logging.INFO)


async def entrypoint(ctx: JobContext):
    await ctx.connect()

    agent = Agent(
        instructions="들리는 모든 한국어를 영어로 번역하시오.",
    )
    session = AgentSession(
        llm=google.beta.realtime.RealtimeModel(
            model="gemini-live-2.5-flash-preview",
            modalities=[Modality.TEXT],
        ),
    )
    session.output.set_audio_enabled(False)

    await session.start(agent=agent, room=ctx.room)


if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            # agent_name="test-agent",
            # load_threshold=0.7,
        )
    )
