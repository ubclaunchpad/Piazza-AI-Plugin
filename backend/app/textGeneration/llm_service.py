import os
import logging
import psycopg
from langchain_groq import ChatGroq
from langchain_postgres import PGVector, PostgresChatMessageHistory
from langchain_openai import OpenAIEmbeddings
from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import HumanMessage, AIMessage
from app.core.config import settings
from app.core.database import execute_statement

logger = logging.getLogger(__name__)

MODEL = "openai/gpt-oss-120b"

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

def get_llm_response(query: str, thread_id: str, session_id: str = None) -> object:
    """
    Get LLM response using Groq with RAG and Chat History.

    Args:
        query: User's question
        thread_id: Thread ID to retrieve context from
        session_id: Optional Chat Session ID for history

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
    
    # 5. Handle Chat History
    history_messages = []
    chat_history = None
    
    
    conn = None
    if session_id:
        try:
            conn = psycopg.connect(settings.DATABASE_URL)
            chat_history = PostgresChatMessageHistory(
                "chat_messages",
                session_id,
                sync_connection=conn
            )
            history_messages = chat_history.messages
        except Exception as e:
            logger.error(f"Failed to load chat history: {e}")

        # 6. Construct Prompt
        template = """You are an intelligent Teaching Assistant for a university course.
Your task is to answer the student's question based on the provided context from Piazza posts and the conversation history.

**Context Analysis:**
The context below contains the top 5 most similar posts found in the database.
- Note: High similarity does not guarantee relevance. The posts might be completely unrelated to the specific question.

**Response Guidelines:**
- **If the context is relevant:** Synthesize the information to provide a helpful, accurate answer.
- **If the context is NOT relevant:** Do not attempt to answer. Simply state that the current course threads do not appear to contain the answer.
- **Style:** Be polite, professional, and concise.

**Context:**
{context}

**Conversation History:**
"""
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", template),
            MessagesPlaceholder(variable_name="history"),
            ("human", "{question}"),
        ])
        
        # 7. Generate Response
        llm = ChatGroq(
            model=MODEL,
            temperature=0.5,
            max_tokens=8192,
            max_retries=3,
        )

        chain = prompt | llm
        response = chain.invoke({
            "context": context_text, 
            "history": history_messages,
            "question": query
        })
        
        # 8. Save to History
        if chat_history:
            try:
                chat_history.add_user_message(query)
                chat_history.add_ai_message(response.content)
            except Exception as e:
                logger.error(f"Failed to save chat history: {e}")
        
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
