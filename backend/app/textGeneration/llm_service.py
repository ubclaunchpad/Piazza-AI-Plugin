"""
Simple LLM service using langchain-groq.
"""

import os
from langchain_groq import ChatGroq


def get_llm_response(query: str) -> str:
    """
    Get LLM response using Groq.

    Args:
        query: User's question

    Returns:
        Generated response string
    """
    llm = ChatGroq(
        model="llama-3.1-70b-versatile",
        api_key=os.getenv("GROQ_API_KEY"),
        temperature=0.7,
    )
    
    response = llm.invoke(query)
    return response.content
