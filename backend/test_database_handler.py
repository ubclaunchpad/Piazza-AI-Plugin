#!/usr/bin/env python3
"""
Test the centralized database connection handler.

This script tests the new database.py module to ensure all connection
methods work properly with the Supabase PostgreSQL instance.
"""

import sys
import traceback
from pathlib import Path

# Add the backend directory to the Python path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from app.core.database import (
    get_db,
    get_direct_connection,
    test_connection,
    init_database_pool,
    close_database_pool
)
from app.core.config import settings

def test_context_manager():
    """Test the context manager approach."""
    print("🔍 Testing context manager (get_db)...")
    try:
        with get_db() as db:
            cursor = db.cursor()
            cursor.execute("SELECT version() as db_version, NOW() as current_time")
            result = cursor.fetchone()
            print(f"   ✅ DB Version: {result['db_version'][:50]}...")
            print(f"   ✅ Current Time: {result['current_time']}")
        return True
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False

def test_direct_connection():
    """Test direct connection approach."""
    print("\n🔍 Testing direct connection...")
    connection = None
    try:
        connection = get_direct_connection()
        cursor = connection.cursor()
        cursor.execute("SELECT current_database(), current_user")
        result = cursor.fetchone()
        print(f"   ✅ Database: {result['current_database']}")
        print(f"   ✅ User: {result['current_user']}")
        return True
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False
    finally:
        if connection:
            connection.close()

def test_connection_test():
    """Test the built-in connection test."""
    print("\n🔍 Testing connection test function...")
    result = test_connection()
    if result:
        print("   ✅ Connection test passed")
    else:
        print("   ❌ Connection test failed")
    return result

def test_supabase_tables():
    """Test querying Supabase-specific tables."""
    print("\n🔍 Testing Supabase table access...")
    try:
        with get_db() as db:
            cursor = db.cursor()
            
            # Check available schemas
            cursor.execute("""
                SELECT schema_name 
                FROM information_schema.schemata 
                WHERE schema_name NOT LIKE 'pg_%' 
                AND schema_name != 'information_schema'
                ORDER BY schema_name
            """)
            schemas = cursor.fetchall()
            print(f"   ✅ Available schemas: {[s['schema_name'] for s in schemas]}")
            
            # Check if we can access auth schema
            cursor.execute("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'auth' 
                LIMIT 3
            """)
            auth_tables = cursor.fetchall()
            if auth_tables:
                print(f"   ✅ Auth tables accessible: {[t['table_name'] for t in auth_tables]}")
            else:
                print("   ⚠️  No auth tables found")
                
        return True
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False

def main():
    """Run all database connection tests."""
    print("=" * 60)
    print("🚀 DATABASE CONNECTION HANDLER TEST")
    print("=" * 60)
    print(f"📍 Database URL: {settings.DATABASE_URL}")
    print("-" * 60)
    
    tests = [
        test_connection_test,
        test_context_manager,
        test_direct_connection,
        test_supabase_tables
    ]
    
    passed = 0
    total = len(tests)
    
    for test_func in tests:
        try:
            if test_func():
                passed += 1
        except Exception as e:
            print(f"   💥 Unexpected error in {test_func.__name__}: {e}")
            print(f"   📝 Traceback: {traceback.format_exc()}")
    
    print("\n" + "=" * 60)
    print(f"📊 RESULTS: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED! Database handler is working correctly.")
        print("\n💡 Usage examples:")
        print("   # Context manager (recommended)")
        print("   with get_db() as db:")
        print("       cursor = db.cursor()")
        print("       cursor.execute('SELECT * FROM users')")
        print("       results = cursor.fetchall()")
        print("")
        print("   # Direct connection")
        print("   conn = get_direct_connection()")
        print("   # ... use connection ...")
        print("   conn.close()")
    else:
        print("❌ SOME TESTS FAILED! Check your Supabase connection.")
        print("\n🔧 Troubleshooting:")
        print("1. Ensure Supabase is running: supabase status")
        print("2. Check DATABASE_URL in .env file")
        print("3. Verify network connectivity")
    
    print("=" * 60)
    
    # Clean up
    close_database_pool()
    return passed == total

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)