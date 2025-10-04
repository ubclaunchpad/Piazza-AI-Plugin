"""
Database configuration and connection management.

This module provides centralized database connection handling using psycopg2
for PostgreSQL/Supabase integration.
"""

import logging
from contextlib import contextmanager
from typing import Generator, Optional

import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2.pool import SimpleConnectionPool

from app.core.config import settings

# Configure logging
logger = logging.getLogger(__name__)

# Global connection pool
_connection_pool: Optional[SimpleConnectionPool] = None


def init_database_pool(min_connections: int = 1, max_connections: int = 10) -> None:
    """
    Initialize the database connection pool.
    
    Args:
        min_connections: Minimum number of connections in the pool
        max_connections: Maximum number of connections in the pool
    """
    global _connection_pool
    
    try:
        _connection_pool = SimpleConnectionPool(
            min_connections,
            max_connections,
            settings.DATABASE_URL
        )
        logger.info(f"Database pool initialized with {min_connections}-{max_connections} connections")
    except Exception as e:
        logger.error(f"Failed to initialize database pool: {e}")
        raise


def get_db_connection():
    """
    Get a database connection from the pool.
    
    Returns:
        psycopg2.connection: Database connection with RealDictCursor
        
    Raises:
        RuntimeError: If connection pool is not initialized
        psycopg2.Error: If unable to get connection
    """
    global _connection_pool
    
    if _connection_pool is None:
        init_database_pool()
    
    try:
        connection = _connection_pool.getconn()
        # Set cursor factory to return dict-like results
        connection.cursor_factory = RealDictCursor
        logger.debug("Database connection acquired from pool")
        return connection
    except Exception as e:
        logger.error(f"Failed to get database connection: {e}")
        raise


def return_db_connection(connection) -> None:
    """
    Return a database connection to the pool.
    
    Args:
        connection: The connection to return to the pool
    """
    global _connection_pool
    
    if _connection_pool and connection:
        try:
            _connection_pool.putconn(connection)
            logger.debug("Database connection returned to pool")
        except Exception as e:
            logger.error(f"Failed to return database connection: {e}")


@contextmanager
def get_db() -> Generator[psycopg2.extensions.connection, None, None]:
    """
    Context manager for database connections.
    
    Automatically handles connection acquisition, commit/rollback, and cleanup.
    
    Usage:
        with get_db() as db:
            cursor = db.cursor()
            cursor.execute("SELECT * FROM users")
            results = cursor.fetchall()
    
    Yields:
        psycopg2.connection: Database connection
    """
    connection = None
    try:
        connection = get_db_connection()
        yield connection
        connection.commit()
        logger.debug("Database transaction committed")
    except Exception as e:
        if connection:
            connection.rollback()
            logger.warning(f"Database transaction rolled back due to error: {e}")
        raise
    finally:
        if connection:
            return_db_connection(connection)


def get_direct_connection():
    """
    Get a direct database connection without using the pool.
    
    Useful for testing or one-off operations.
    
    Returns:
        psycopg2.connection: Direct database connection
        
    Note:
        Remember to close the connection manually when done.
    """
    try:
        connection = psycopg2.connect(
            settings.DATABASE_URL,
            cursor_factory=RealDictCursor
        )
        logger.debug("Direct database connection established")
        return connection
    except Exception as e:
        logger.error(f"Failed to establish direct database connection: {e}")
        raise


def close_database_pool() -> None:
    """Close all connections in the database pool."""
    global _connection_pool
    
    if _connection_pool:
        try:
            _connection_pool.closeall()
            _connection_pool = None
            logger.info("Database connection pool closed")
        except Exception as e:
            logger.error(f"Error closing database pool: {e}")


def test_connection() -> bool:
    """
    Test database connectivity.
    
    Returns:
        bool: True if connection successful, False otherwise
    """
    try:
        with get_db() as db:
            cursor = db.cursor()
            cursor.execute("SELECT 1 as test")
            result = cursor.fetchone()
            success = result and result['test'] == 1
            
        if success:
            logger.info("Database connection test successful")
        else:
            logger.error("Database connection test failed: unexpected result")
            
        return success
        
    except Exception as e:
        logger.error(f"Database connection test failed: {e}")
        return False


# Helper functions for common database operations

def execute_query(query: str, params=None, fetch_one: bool = False):
    """
    Execute a query and return results.
    
    Args:
        query: SQL query to execute
        params: Query parameters (optional)
        fetch_one: If True, return only the first result
        
    Returns:
        Query results as dict or list of dicts
        
    Example:
        # Get all users
        users = execute_query("SELECT * FROM auth.users LIMIT 10")
        
        # Get specific user
        user = execute_query(
            "SELECT * FROM auth.users WHERE id = %s", 
            (user_id,), 
            fetch_one=True
        )
    """
    with get_db() as db:
        cursor = db.cursor()
        cursor.execute(query, params)
        
        if fetch_one:
            return cursor.fetchone()
        else:
            return cursor.fetchall()


def execute_insert(query: str, params=None, return_id: bool = True):
    """
    Execute an INSERT query and optionally return the inserted ID.
    
    Args:
        query: INSERT SQL query
        params: Query parameters (optional)
        return_id: If True, return the inserted row's ID
        
    Returns:
        Inserted row ID if return_id=True, otherwise None
        
    Example:
        # Insert new record and get ID
        new_id = execute_insert(
            "INSERT INTO posts (title, content) VALUES (%s, %s) RETURNING id",
            ("My Title", "My Content")
        )
    """
    with get_db() as db:
        cursor = db.cursor()
        cursor.execute(query, params)
        
        if return_id:
            result = cursor.fetchone()
            return result[0] if result else None
        

# Initialize the connection pool when module is imported
# This can be disabled by setting an environment variable if needed
if not settings.ENVIRONMENT == "test":
    try:
        init_database_pool()
    except Exception as e:
        logger.warning(f"Failed to initialize database pool on import: {e}")
        logger.warning("Database connections will be initialized on first use")
