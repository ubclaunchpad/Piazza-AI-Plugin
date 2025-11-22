"""
Post processor for converting Piazza posts to text with rich metadata.
"""

import re
from datetime import datetime
from typing import Dict, List, Optional, Any
from html import unescape
from dataclasses import dataclass, asdict


@dataclass
class PostMetadata:
    """Rich metadata for a Piazza post."""
    
    post_id: str
    post_number: int
    subject: str
    post_type: str  # question, note, poll
    author_role: Optional[str]  # student, instructor, ta
    created_at: str
    modified_at: Optional[str]
    tags: List[str]
    folders: List[str]
    num_favorites: int
    unique_views: int
    has_instructor_answer: bool
    has_student_answer: bool
    num_followups: int
    status: str  # active, deleted, private
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert metadata to dictionary."""
        return asdict(self)


@dataclass
class PostChunk:
    """A single chunk representing a post with metadata."""
    
    chunk_id: str
    text: str
    metadata: PostMetadata
    chunk_type: str  # main_post, instructor_answer, student_answer, followup
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert chunk to dictionary."""
        return {
            "chunk_id": self.chunk_id,
            "text": self.text,
            "metadata": self.metadata.to_dict(),
            "chunk_type": self.chunk_type,
        }


class PostProcessor:
    """Process Piazza posts into text chunks with metadata."""
    
    @staticmethod
    def strip_html(html_content: str) -> str:
        """
        Remove HTML tags and convert to clean text.
        
        Args:
            html_content: HTML string from Piazza post
            
        Returns:
            Clean text without HTML tags
        """
        if not html_content:
            return ""
        
        # Unescape HTML entities
        text = unescape(html_content)
        
        # Replace common HTML tags with appropriate spacing
        text = re.sub(r'<br\s*/?>', '\n', text)
        text = re.sub(r'</?p>', '\n', text)
        text = re.sub(r'</?div>', '\n', text)
        text = re.sub(r'<li>', '\n• ', text)
        text = re.sub(r'</li>', '', text)
        
        # Handle code blocks - preserve formatting
        text = re.sub(r'<pre>(.*?)</pre>', r'\n```\n\1\n```\n', text, flags=re.DOTALL)
        text = re.sub(r'<code>(.*?)</code>', r'`\1`', text)
        
        # Remove all remaining HTML tags
        text = re.sub(r'<[^>]+>', '', text)
        
        # Clean up whitespace
        text = re.sub(r'\n\s*\n\s*\n', '\n\n', text)  # Max 2 newlines
        text = re.sub(r'[ \t]+', ' ', text)  # Normalize spaces
        text = text.strip()
        
        return text
    
    @staticmethod
    def extract_metadata(post: Dict[str, Any]) -> PostMetadata:
        """
        Extract metadata from a Piazza post.
        
        Args:
            post: Raw post data from Piazza API
            
        Returns:
            PostMetadata object
        """
        # Get the latest history entry (current version)
        history = post.get("history", [{}])
        current = history[0] if history else {}
        
        # Check for answer types
        children = post.get("children", [])
        has_instructor_answer = any(
            child.get("type") == "i_answer" for child in children
        )
        has_student_answer = any(
            child.get("type") == "s_answer" for child in children
        )
        
        # Count followups
        num_followups = sum(
            1 for child in children 
            if child.get("type") == "followup"
        )
        
        return PostMetadata(
            post_id=post.get("id", ""),
            post_number=post.get("nr", 0),
            subject=current.get("subject", "Untitled"),
            post_type=post.get("type", "question"),
            author_role=post.get("role", None),
            created_at=post.get("created", ""),
            modified_at=post.get("modified", None),
            tags=post.get("tags", []),
            folders=post.get("folders", []),
            num_favorites=post.get("num_favorites", 0),
            unique_views=post.get("unique_views", 0),
            has_instructor_answer=has_instructor_answer,
            has_student_answer=has_student_answer,
            num_followups=num_followups,
            status=post.get("status", "active"),
        )
    
    @staticmethod
    def process_main_post(post: Dict[str, Any]) -> PostChunk:
        """
        Process the main post content into a chunk.
        
        Args:
            post: Raw post data from Piazza API
            
        Returns:
            PostChunk for the main post
        """
        metadata = PostProcessor.extract_metadata(post)
        
        # Get the latest version of the post
        history = post.get("history", [{}])
        current = history[0] if history else {}
        
        # Extract and clean content
        subject = current.get("subject", "Untitled")
        raw_content = current.get("content", "")
        clean_content = PostProcessor.strip_html(raw_content)
        
        # Format the text
        text_parts = [
            f"# {subject}",
            f"",
            f"**Type:** {metadata.post_type.capitalize()}",
            f"**Posted:** {metadata.created_at}",
            f"**Tags:** {', '.join(metadata.tags) if metadata.tags else 'None'}",
            f"",
            f"## Question/Content",
            clean_content,
        ]
        
        text = "\n".join(text_parts)
        chunk_id = f"{metadata.post_id}_main"
        
        return PostChunk(
            chunk_id=chunk_id,
            text=text,
            metadata=metadata,
            chunk_type="main_post",
        )
    
    @staticmethod
    def process_answer(
        answer: Dict[str, Any],
        post_metadata: PostMetadata,
        answer_type: str
    ) -> Optional[PostChunk]:
        """
        Process an answer (instructor or student) into a chunk.
        
        Args:
            answer: Answer data from post children
            post_metadata: Metadata from the main post
            answer_type: "instructor_answer" or "student_answer"
            
        Returns:
            PostChunk for the answer, or None if no content
        """
        # Get answer history
        history = answer.get("history", [{}])
        current = history[0] if history else {}
        
        raw_content = current.get("content", "")
        if not raw_content:
            return None
        
        clean_content = PostProcessor.strip_html(raw_content)
        
        # Format the answer text
        answer_label = "Instructor's Answer" if answer_type == "instructor_answer" else "Student's Answer"
        text_parts = [
            f"## {answer_label}",
            f"",
            clean_content,
        ]
        
        # Check if answer was endorsed
        if answer.get("endorsed", False):
            text_parts.insert(1, f"**✓ Endorsed Answer**")
            text_parts.insert(2, "")
        
        text = "\n".join(text_parts)
        chunk_id = f"{post_metadata.post_id}_{answer_type}"
        
        return PostChunk(
            chunk_id=chunk_id,
            text=text,
            metadata=post_metadata,
            chunk_type=answer_type,
        )
    
    @staticmethod
    def process_followups(
        children: List[Dict[str, Any]],
        post_metadata: PostMetadata
    ) -> List[PostChunk]:
        """
        Process followup discussions into chunks.
        
        Args:
            children: List of child posts (followups, replies)
            post_metadata: Metadata from the main post
            
        Returns:
            List of PostChunks for followups
        """
        chunks = []
        followup_count = 0
        
        for child in children:
            if child.get("type") != "followup":
                continue
            
            followup_count += 1
            
            # Get followup content
            history = child.get("history", [{}])
            current = history[0] if history else {}
            
            followup_subject = current.get("subject", "Follow-up Discussion")
            raw_content = current.get("content", "")
            clean_content = PostProcessor.strip_html(raw_content)
            
            if not clean_content:
                continue
            
            # Build followup text with replies
            text_parts = [
                f"### Follow-up #{followup_count}: {followup_subject}",
                f"",
                clean_content,
            ]
            
            # Process replies to this followup
            replies = child.get("children", [])
            if replies:
                text_parts.append("")
                text_parts.append("**Replies:**")
                text_parts.append("")
                
                for idx, reply in enumerate(replies, 1):
                    reply_history = reply.get("history", [{}])
                    reply_current = reply_history[0] if reply_history else {}
                    reply_content = PostProcessor.strip_html(
                        reply_current.get("content", "")
                    )
                    
                    if reply_content:
                        role = reply.get("role", "user")
                        role_label = f"[{role.upper()}]" if role else ""
                        text_parts.append(f"{idx}. {role_label} {reply_content}")
                        text_parts.append("")
            
            text = "\n".join(text_parts)
            chunk_id = f"{post_metadata.post_id}_followup_{followup_count}"
            
            chunks.append(PostChunk(
                chunk_id=chunk_id,
                text=text,
                metadata=post_metadata,
                chunk_type="followup",
            ))
        
        return chunks
    
    @staticmethod
    def process_post(post: Dict[str, Any]) -> List[PostChunk]:
        """
        Process a complete Piazza post into a single unified chunk.
        
        Args:
            post: Complete post data from Piazza API
            
        Returns:
            List containing one PostChunk with all content unified
        """
        metadata = PostProcessor.extract_metadata(post)
        
        # Get the latest version of the post
        history = post.get("history", [{}])
        current = history[0] if history else {}
        
        # Extract and clean main post content
        subject = current.get("subject", "Untitled")
        raw_content = current.get("content", "")
        clean_content = PostProcessor.strip_html(raw_content)
        
        # Start building unified text
        text_parts = [
            f"# {subject}",
            f"",
            f"## Main Post",
            clean_content,
            f"",
        ]
        
        # Process all children
        children = post.get("children", [])
        
        # Track responses by type
        instructor_responses = []
        student_responses = []
        followups = []
        
        for child in children:
            child_type = child.get("type", "")
            
            if child_type == "i_answer":
                instructor_responses.append(child)
            elif child_type == "s_answer":
                student_responses.append(child)
            elif child_type == "followup":
                followups.append(child)
        
        # Add instructor responses
        for idx, response in enumerate(instructor_responses, 1):
            history = response.get("history", [{}])
            current = history[0] if history else {}
            raw_content = current.get("content", "")
            clean_content = PostProcessor.strip_html(raw_content)
            
            if clean_content:
                endorsed = "✓ Endorsed " if response.get("endorsed", False) else ""
                text_parts.append(f"## Instructor Response {idx if len(instructor_responses) > 1 else ''}")
                if endorsed:
                    text_parts.append(f"**{endorsed}**")
                text_parts.append(clean_content)
                text_parts.append("")
        
        # Add student responses
        for idx, response in enumerate(student_responses, 1):
            history = response.get("history", [{}])
            current = history[0] if history else {}
            raw_content = current.get("content", "")
            clean_content = PostProcessor.strip_html(raw_content)
            
            if clean_content:
                endorsed = "✓ Endorsed " if response.get("endorsed", False) else ""
                text_parts.append(f"## Student Response {idx if len(student_responses) > 1 else ''}")
                if endorsed:
                    text_parts.append(f"**{endorsed}**")
                text_parts.append(clean_content)
                text_parts.append("")
        
        # Add followup discussions
        for followup_num, followup in enumerate(followups, 1):
            # Get followup content
            history = followup.get("history", [{}])
            current = history[0] if history else {}
            
            followup_subject = current.get("subject", "")
            raw_content = current.get("content", "")
            clean_content = PostProcessor.strip_html(raw_content)
            
            if clean_content:
                text_parts.append(f"## Follow-up Discussion {followup_num}")
                if followup_subject:
                    text_parts.append(f"**{followup_subject}**")
                text_parts.append(clean_content)
                text_parts.append("")
                
                # Add replies to this followup
                replies = followup.get("children", [])
                if replies:
                    for reply_idx, reply in enumerate(replies, 1):
                        reply_history = reply.get("history", [{}])
                        reply_current = reply_history[0] if reply_history else {}
                        reply_content = PostProcessor.strip_html(
                            reply_current.get("content", "")
                        )
                        
                        if reply_content:
                            role = reply.get("role", "")
                            if role:
                                role_label = f"**{role.capitalize()} Reply {reply_idx}:**"
                            else:
                                role_label = f"**Reply {reply_idx}:**"
                            
                            text_parts.append(role_label)
                            text_parts.append(reply_content)
                            text_parts.append("")
        
        # Combine all text
        text = "\n".join(text_parts)
        chunk_id = f"{metadata.post_id}_unified"
        
        return [PostChunk(
            chunk_id=chunk_id,
            text=text,
            metadata=metadata,
            chunk_type="unified",
        )]
    
    @staticmethod
    def create_combined_chunk(post: Dict[str, Any]) -> PostChunk:
        """
        Create a single unified chunk with all post content.
        Alias for process_post that returns the single chunk directly.
        
        Args:
            post: Complete post data from Piazza API
            
        Returns:
            Single PostChunk with all content unified
        """
        chunks = PostProcessor.process_post(post)
        return chunks[0] if chunks else None
