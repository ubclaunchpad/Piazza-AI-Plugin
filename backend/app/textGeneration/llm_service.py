import logging
import os

import psycopg
from langchain.chains import create_history_aware_retriever, create_retrieval_chain
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import AIMessage
from langchain_core.output_parsers import StrOutputParser
from langchain_groq import ChatGroq
from langchain_openai import OpenAIEmbeddings
from langchain_postgres import PGVector, PostgresChatMessageHistory

from app.core.config import settings
from app.core.database import execute_query, execute_statement

logger = logging.getLogger(__name__)

MODEL = "openai/gpt-oss-120b"
CHAT_SESSION_MODEL = "llama-3.1-8b-instant"


def ensure_chat_history_tables():
    """Ensure chat history tables exist using raw SQL."""
    try:
        # Schema for langchain-postgres PostgresChatMessageHistory
        # It uses a JSONB column for the message
        query = """
        CREATE TABLE IF NOT EXISTS chat_messages (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            session_id UUID NOT NULL,
            message JSONB NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
        """
        execute_statement(query)
    except Exception as e:
        logger.error(f"Failed to ensure chat history tables: {e}")


# Initialize tables on module load
ensure_chat_history_tables()


# --- 1. Session History Factory ---
# This function is called automatically by RunnableWithMessageHistory
# whenever a specific session_id is invoked.
def get_session_history(session_id: str):
    # Note: In production, consider using a connection pool here
    # rather than creating a new sync connection every time.
    sync_connection = psycopg.connect(settings.DATABASE_URL)
    return PostgresChatMessageHistory(
        "chat_messages", session_id, sync_connection=sync_connection
    )


def update_session_title(session_id: str):
    """
    Updates the session title if it is currently 'New Chat'.
    Uses the LLM to generate a concise title based on the first interaction found in history.
    """
    try:
        # 1. Check current title
        check_query = "SELECT title FROM chat_sessions WHERE id = %s"
        result = execute_query(check_query, (session_id,), fetch_one=True)

        if not result or result["title"] != "New Chat":
            return

        # 2. Get first user query and AI response directly from DB
        # We query for the message JSON to be safe about content location (top-level vs inside data)
        msg_query = """
            SELECT message
            FROM chat_messages
            WHERE session_id = %s AND message ->> 'type' = %s
            ORDER BY created_at ASC
            LIMIT 1
        """

        first_user_result = execute_query(
            msg_query, (session_id, "human"), fetch_one=True
        )
        first_ai_result = execute_query(msg_query, (session_id, "ai"), fetch_one=True)

        if not first_user_result or not first_ai_result:
            return

        # Helper to extract content safely
        def get_content(msg_json):
            if "content" in msg_json:
                return msg_json["content"]
            if "data" in msg_json and "content" in msg_json["data"]:
                return msg_json["data"]["content"]
            return None

        first_user_query = get_content(first_user_result["message"])
        first_ai_response = get_content(first_ai_result["message"])

        if not first_user_query or not first_ai_response:
            return

        # 3. Generate new title
        llm = ChatGroq(
            model=CHAT_SESSION_MODEL,
            temperature=0.5,
            max_tokens=20,
            max_retries=3,
        )

        title_prompt = ChatPromptTemplate.from_messages(
            [
                (
                    "system",
                    "Generate a very concise title (3-5 words) for this chat session based on the first user query and AI response. Do not use quotes. Respond with ONLY the title, no additional text. The title (which will be your entire response) should be less than 35 characters.",
                ),
                ("human", f"User: {first_user_query}\nAI: {first_ai_response}"),
            ]
        )

        chain = title_prompt | llm | StrOutputParser()
        new_title = chain.invoke({})

        # Clean up title
        new_title = new_title.strip().strip('"').strip("'")
        # 4. Update database
        update_query = (
            "UPDATE chat_sessions SET title = %s, updated_at = NOW() WHERE id = %s"
        )
        execute_statement(update_query, (new_title, session_id))

    except Exception as e:
        logger.error(f"Failed to update session title: {e}")


def get_llm_response(query: str, thread_id: str, session_id: str) -> object:
    # 1. Setup Models & Embeddings
    openai_api_key = os.environ.get("OPENAI_API_KEY")
    if not openai_api_key:
        raise ValueError("OPENAI_API_KEY must be set")

    embeddings = OpenAIEmbeddings(model="text-embedding-3-large")

    llm = ChatGroq(
        model=MODEL,
        temperature=0.5,
        max_tokens=8192,
        max_retries=3,
    )

    # 2. Setup Vector Store as Retriever
    vector_store = PGVector(
        collection_name=thread_id,
        connection=settings.DATABASE_URL,
        embeddings=embeddings,
        use_jsonb=True,
    )
    retriever = vector_store.as_retriever(search_kwargs={"k": 5})

    # --- 3. Construct the History-Aware Retriever ---
    # This chain reformulates the query if history exists

    contextualize_q_system_prompt = """Given a chat history and the latest user question which might reference context in the chat history,
        formulate a standalone question which can be understood without the chat history.
        Do NOT answer the question, just reformulate it if needed and otherwise return it as is.
        If the latest user question is a completely new topic and does not reference the chat history, return the question exactly as is.
        Do NOT combine the new question with previous topics if they are unrelated."""

    contextualize_q_prompt = ChatPromptTemplate.from_messages(
        [
            ("system", contextualize_q_system_prompt),
            MessagesPlaceholder("chat_history"),
            ("human", "{input}"),
        ]
    )

    # This retriever will now output relevant docs based on the *intent* of the conversation
    history_aware_retriever = create_history_aware_retriever(
        llm, retriever, contextualize_q_prompt
    )

    # --- 4. Construct the QA Chain ---
    # This acts on the retrieved docs

    qa_system_prompt = """You are an intelligent Teaching Assistant for a university course.
        Your task is to answer the student's question based on the provided context from Piazza posts and the conversation history.

        **Context Analysis:**
        The context below contains the top 5 most similar posts found in the database.
        - Note: High similarity does not guarantee relevance. The posts might be completely unrelated to the specific question.

        **Response Guidelines:**
        - **Answer ONLY the latest question from the user.** Do not attempt to answer previous questions in the chat history.
        - **If the context is relevant:** Synthesize the information to provide a helpful, accurate answer.
        - **If the context is NOT relevant:** Do not attempt to answer. Simply state that the current course threads do not appear to contain the answer.
        - **Style:** Be polite, professional, and concise.

        **Context:**

        {context}"""

    qa_prompt = ChatPromptTemplate.from_messages(
        [
            ("system", qa_system_prompt),
            MessagesPlaceholder("chat_history"),
            ("human", "{input}"),
        ]
    )

    # Combines the docs into the prompt
    question_answer_chain = create_stuff_documents_chain(llm, qa_prompt)

    # Combines Retrieval + Generation
    rag_chain = create_retrieval_chain(history_aware_retriever, question_answer_chain)

    # --- 5. Manual History Management ---
    # We manually manage history to inject metadata (sources) into the AI message
    history = get_session_history(session_id)

    # --- Debugging: Print Contextualized Question ---
    debug_chain = contextualize_q_prompt | llm | StrOutputParser()
    reformulated_query = debug_chain.invoke(
        {"chat_history": history.messages, "input": query}
    )
    print(f"\n[DEBUG] Original Query: {query}")
    print(f"[DEBUG] Reformulated Query: {reformulated_query}\n")

    # --- 6. Invoke ---
    # Pass history messages directly to the chain
    response_dict = rag_chain.invoke({"input": query, "chat_history": history.messages})

    # --- 7. Formatting Response & Saving History ---

    # Extract sources
    sources = []
    if "context" in response_dict:
        for doc in response_dict["context"]:
            if "post_number" in doc.metadata:
                sources.append(str(doc.metadata["post_number"]))
            elif "post_id" in doc.metadata:
                sources.append(str(doc.metadata["post_id"]))

    unique_sources = list(dict.fromkeys(sources))

    # Save to history
    history.add_user_message(query)

    ai_message = AIMessage(
        content=response_dict["answer"], response_metadata={"sources": unique_sources}
    )
    history.add_message(ai_message)

    # --- 8. Update Session Title (if needed) ---
    # We do this asynchronously or just fire-and-forget here
    update_session_title(session_id)

    # --- 9. Update Session Timestamp ---
    try:
        update_time_query = "UPDATE chat_sessions SET updated_at = NOW() WHERE id = %s"
        execute_statement(update_time_query, (session_id,))
    except Exception as e:
        logger.error(f"Failed to update session timestamp: {e}")

    # Create a simple object or dict to return to your API
    class ResponseObj:
        pass

    result = ResponseObj()
    result.content = response_dict["answer"]
    result.sources = unique_sources
    result.model = MODEL

    return result
