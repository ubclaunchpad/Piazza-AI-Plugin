"""
Simple LLM service using langchain-groq.
"""

from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage

MODEL = "openai/gpt-oss-120b"

SYSTEM_MESSAGE = SystemMessage(
    content="""
        You are ThreadSense, a course assistant specializing in structured Q&A.
        You must follow this multi-step reasoning process internally, but only output the final result:

        1. Never hallucinate missing facts.
        2. If the question is ambiguous, ask the user for clarification.
        3. If the user asks a follow-up question, reuse previous context when possible.

        Chain-of-Thought Framework (INTERNAL ONLY - DO NOT OUTPUT):
        Step 1 — Understand the question.
        Step 2 — Identify relevant key words from the question.
        Step 3 — Search your knowledge base for relevant sources.
        Step 4 — Reason about the answer.
        Step 5 — Produce the final formatted answer.

        ### Final Output Format:
        1) A canonical answer (3-6 bullet steps or a short paragraph) 
        2) A confidence score 0-100.
        3) A list of exact sources used (source ID, embedded link and short excerpt).
    """
)

def get_llm_response(query: str) -> object:
    """
    Get LLM response using Groq.

    Args:
        query: User's question

    Returns:
        Generated response string
    """
    llm = ChatGroq(
        model=MODEL,
        temperature=0.1,
        max_tokens=8192,
        max_retries=3,
    )

    messages = [
        SYSTEM_MESSAGE,
        HumanMessage(content=query)
    ]

    response = llm.invoke(messages)
    response.model = MODEL
    return response
