from supabase import create_client, Client
import os
from dotenv import load_dotenv

load_dotenv()

supabaseUrl = os.getenv("VITE_SUPABASE_URL")
supabaseAnonKey = os.getenv("VITE_SUPABASE_ANON_KEY")

supabase: Client = create_client(supabaseUrl, supabaseAnonKey)