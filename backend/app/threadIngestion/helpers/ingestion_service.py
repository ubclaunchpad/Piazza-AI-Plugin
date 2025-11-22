"""
Thread ingestion service for processing Piazza posts.
"""

from typing import List, Dict, Any
from .User import User
from .post_processor import PostProcessor, PostChunk


class ThreadIngestionService:
    """Service for ingesting and processing Piazza threads."""
    
    def __init__(self, csrf_token: str, piazza_session: str):
        """
        Initialize the ingestion service.
        
        Args:
            csrf_token: session_id cookie value
            piazza_session: piazza_session cookie value
        """
        self.user = User(csrf_token, piazza_session)
        self.processor = PostProcessor()
    
    @staticmethod
    def parse_cookies(cookie_string: str) -> Dict[str, str]:
        """
        Parse cookie string into dictionary.
        
        Args:
            cookie_string: Cookie string from browser (e.g., "name1=value1; name2=value2")
            
        Returns:
            Dictionary of cookie name-value pairs
        """
        cookies = {}
        
        if not cookie_string:
            return cookies
        
        # Split by semicolon and parse each cookie
        for cookie in cookie_string.split(';'):
            cookie = cookie.strip()
            if '=' in cookie:
                name, value = cookie.split('=', 1)
                cookies[name.strip()] = value.strip()
        
        return cookies
    
    @classmethod
    def from_cookie_string(cls, cookie_string: str) -> "ThreadIngestionService":
        """
        Create service instance from cookie string.
        
        Args:
            cookie_string: Cookie string containing session_id and piazza_session
            
        Returns:
            ThreadIngestionService instance
            
        Raises:
            ValueError: If required cookies are missing
        """
        cookies = cls.parse_cookies(cookie_string)
        
        csrf_token = cookies.get('session_id')
        piazza_session = cookies.get('piazza_session')
        
        if not csrf_token:
            raise ValueError("Missing required cookie: session_id")
        if not piazza_session:
            raise ValueError("Missing required cookie: piazza_session")
        
        return cls(csrf_token, piazza_session)
    
    def ingest_post(
        self,
        post_number: int,
        network_id: str,
    ) -> List[PostChunk]:
        """
        Ingest a single post and convert to unified chunk.
        
        Args:
            post_number: Post number (nr field)
            network_id: Course/network ID
            
        Returns:
            List containing one PostChunk with unified format
            
        Raises:
            Exception: If post retrieval fails
        """
        # Fetch post content
        post_data = self.user.getPostContent(post_number, network_id)
        
        if not post_data:
            raise Exception(f"Failed to retrieve post {post_number}")
        
        # Process into unified chunk
        chunks = self.processor.process_post(post_data)
        return chunks
    
    def ingest_multiple_posts(
        self,
        network_id: str,
        offset: int = 0,
        limit: int = 9999,
    ) -> List[PostChunk]:
        """
        Ingest multiple posts from a network.
        
        Args:
            network_id: Course/network ID
            offset: Starting offset for posts
            limit: Number of posts to fetch
            
        Returns:
            List of PostChunk objects (one unified chunk per post)
        """
        all_chunks = []
        
        # Get post list
        posts_feed = self.user.getPosts(offset, limit, network_id)
        feed_items = posts_feed.get("feed", [])
        
        # Process each post
        for item in feed_items:
            post_number = item.get("nr")
            if not post_number:
                continue
            
            try:
                chunks = self.ingest_post(post_number, network_id)
                all_chunks.extend(chunks)
            except Exception as e:
                print(f"Error processing post {post_number}: {e}")
                continue
        
        return all_chunks
    
    def ingest_thread_by_id(
        self,
        thread_id: str,
        offset: int = 0,
        limit: int = 20,
    ) -> List[PostChunk]:
        """
        Ingest a thread using its ID (could be post number or class ID).
        
        Args:
            thread_id: Thread identifier (can be "classId@postNum" or just classId)
            
        Returns:
            List of PostChunk objects (one unified chunk per post)
            
        Raises:
            ValueError: If thread_id format is invalid
        """
        # Check if thread_id contains both class and post number
        if '@' in thread_id:
            # Format: classId@postNum
            network_id, post_num_str = thread_id.split('@', 1)
            try:
                post_number = int(post_num_str)
                return self.ingest_post(post_number, network_id)
            except ValueError:
                raise ValueError(f"Invalid post number in thread_id: {post_num_str}")
        
        # Otherwise treat as network_id and fetch recent posts
        network_id = thread_id
        return self.ingest_multiple_posts(
            network_id=network_id,
            offset=offset,
            limit=limit
        )
    
    def get_post_summary(self, post_number: int, network_id: str) -> Dict[str, Any]:
        """
        Get a summary of a post without full content.
        
        Args:
            post_number: Post number
            network_id: Course/network ID
            
        Returns:
            Dictionary with post summary
        """
        post_data = self.user.getPostContent(post_number, network_id)
        metadata = self.processor.extract_metadata(post_data)
        
        return {
            "post_number": post_number,
            "subject": metadata.subject,
            "type": metadata.post_type,
            "created_at": metadata.created_at,
            "tags": metadata.tags,
            "has_answers": metadata.has_instructor_answer or metadata.has_student_answer,
            "num_followups": metadata.num_followups,
            "unique_views": metadata.unique_views,
        }
