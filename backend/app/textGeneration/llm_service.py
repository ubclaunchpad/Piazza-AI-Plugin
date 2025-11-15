"""
Simple LLM service using langchain-groq.
"""

from langchain_groq import ChatGroq

MODEL = "openai/gpt-oss-120b"
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
        temperature=0.7,
        max_tokens=8192,
        max_retries=3,
    )

    response = llm.invoke(query)
    response.model = MODEL
    return response
