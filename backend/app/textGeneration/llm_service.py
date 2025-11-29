"""
Simple LLM service using langchain-groq.
"""

import os
from langchain_groq import ChatGroq
from langchain_postgres import PGVector
from langchain_openai import OpenAIEmbeddings
from langchain.prompts import ChatPromptTemplate
from app.core.config import settings

MODEL = "openai/gpt-oss-120b"

def get_llm_response(query: str, thread_id: str) -> object:
    """
    Get LLM response using Groq with RAG.

    Args:
        query: User's question
        thread_id: Thread ID to retrieve context from

    Returns:
        Generated response string
    """
    # 1. Initialize Embeddings
    openai_api_key = os.environ.get("OPENAI_API_KEY")
    if not openai_api_key:
         raise ValueError("OPENAI_API_KEY must be set")
    embeddings = OpenAIEmbeddings(model="text-embedding-3-large")
    
    # 2. Initialize PGVector store
    vector_store = PGVector(
        collection_name=thread_id,
        connection=settings.DATABASE_URL,
        embeddings=embeddings,
        use_jsonb=True,
    )

    # 3. Retrieve relevant documents
    # Get top 5 most relevant chunks
    docs = vector_store.similarity_search(query, k=5)
    
    # 4. Construct Context
    context_text = "\n\n".join([doc.page_content for doc in docs])
    
    # 5. Construct Prompt
    template = """You are an intelligent Teaching Assistant for a university course.
Your task is to answer the student's question based on the provided context from Piazza posts.

**Context Analysis:**
The context below contains the top 5 most similar posts found in the database.
- Note: High similarity does not guarantee relevance. The posts might be completely unrelated to the specific question.

**Response Guidelines:**
- **If the context is relevant:** Synthesize the information to provide a helpful, accurate answer.
- **If the context is NOT relevant:** Do not attempt to answer. Simply state that the current course threads do not appear to contain the answer.
- **Style:** Be polite, professional, and concise.

**Context:**
{context}

**Student Question:**
{question}
"""
    prompt = ChatPromptTemplate.from_template(template)
    
    # 6. Generate Response
    llm = ChatGroq(
        model=MODEL,
        temperature=0.5,
        max_tokens=8192,
        max_retries=3,
    )

    chain = prompt | llm
    response = chain.invoke({"context": context_text, "question": query})
    
    # Extract sources
    sources = []
    for doc in docs:
        if "post_number" in doc.metadata:
            sources.append(str(doc.metadata["post_number"]))
        elif "post_id" in doc.metadata:
            sources.append(str(doc.metadata["post_id"]))
            
    # Deduplicate sources while preserving order
    response.sources = list(dict.fromkeys(sources))
    response.model = MODEL
    return response
