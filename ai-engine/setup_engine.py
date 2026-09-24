import os
import json

ENGINE_DIR = "ai-engine"
FILES = {
    "requirements.txt": """google-genai>=1.0.0
google-api-python-client>=2.120.0
google-auth-httplib2>=0.2.0
google-auth-oauthlib>=1.2.0
pydantic>=2.6.0
opencv-python-headless>=4.9.0
python-dotenv>=1.0.1
ipykernel""",

    "models.py": """from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class WaterDamageSource(str, Enum):
    NEDBOR = "NEDBØR"
    TRYKKSATT_ROR = "TRYKKSATT_RØR"
    AVLOPSROR = "AVLØPSRØR"
    KONDENS = "KONDENS"
    UTETT_BAD = "UTETT_BAD"
    USIKKER = "USIKKER"


class AcuteOrGradual(str, Enum):
    AKUTT = "AKUTT"
    GRADVIS = "GRADVIS"
    USIKKER = "USIKKER"


class Evidence(BaseModel):
    timestamp_ms: Optional[int] = None
    caption: str
    visual_confirmation: str
    source_photo_index: Optional[int] = None
    technical_reference: Optional[str] = None


class DamageAnalysis(BaseModel):
    area: str
    source: str
    source_category: WaterDamageSource
    cause: str
    acute_or_gradual: AcuteOrGradual
    description: str
    evidence_points: List[Evidence]
    is_habitable: bool
    extent_description: str
    repairs_description: str
""",

    "google_api.py": """from google.oauth2 import service_account
from googleapiclient.discovery import build

SCOPES = ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/documents']

def connect_to_google_api(creds_path):
    creds = service_account.Credentials.from_service_account_file(creds_path, scopes=SCOPES)
    return build('docs', 'v1', credentials=creds), build('drive', 'v3', credentials=creds)
""",

    "test_engine.ipynb": json.dumps({
 "cells": [
  {
   "cell_type": "markdown",
   "metadata": {},
   "source": [
    "# AI Engine Raw Tester\\n",
    "Use this notebook to test the pipeline with hardcoded paths before deployment."
   ]
  },
  {
   "cell_type": "code",
   "execution_count": None,
   "metadata": {},
   "outputs": [],
   "source": [
    "# 1. Setup Environment\\n",
    "import os\\n",
    "from main import create_report\\n",
    "from dotenv import load_dotenv\\n",
    "load_dotenv() # Load from .env file"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": None,
   "metadata": {},
   "outputs": [],
   "source": [
    "# 2. Hardcoded Test Configuration\\n",
    "VIDEO_PATH = 'path/to/your/test_video.mp4'\\n",
    "CREDS_PATH = 'credentials.json'\\n",
    "MASTER_ID = 'YOUR_GOOGLE_DOC_MASTER_ID'\\n",
    "FOLDER_ID = 'YOUR_GOOGLE_DRIVE_OUTPUT_FOLDER_ID'\\n",
    "GEMINI_KEY = os.getenv('GEMINI_API_KEY') # Or hardcode string here for raw test"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": None,
   "metadata": {},
   "outputs": [],
   "source": [
    "# 3. Run Pipeline\\n",
    "doc_id, analysis, token_usage, citation_stats = create_report(\\n",
    "    video_path=VIDEO_PATH, \\n",
    "    master_id=MASTER_ID, \\n",
    "    output_folder=FOLDER_ID, \\n",
    "    gemini_key=GEMINI_KEY\\n",
    ")\\n",
    "print(f'Done! Check your report here: https://docs.google.com/document/d/{doc_id}')"
   ]
  }
 ],
 "metadata": {
  "kernelspec": {
   "display_name": "Python 3",
   "language": "python",
   "name": "python3"
  }
 },
 "nbformat": 4,
 "nbformat_minor": 4
})
}

def setup():
    if not os.path.exists(ENGINE_DIR):
        os.makedirs(ENGINE_DIR)
        print(f"Created directory: {ENGINE_DIR}")
    
    for filename, content in FILES.items():
        path = os.path.join(ENGINE_DIR, filename)
        if os.path.exists(path):
            print(f"  - Preserved existing file: {filename}")
            continue
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"  - Created file: {filename}")

    print("\n✅ ai-engine setup complete. Next steps:")
    print(f"1. cd {ENGINE_DIR}")
    print("2. Create a .env file and add GEMINI_API_KEY=your_key_here")
    print("3. Open test_engine.ipynb and run the cells.")

if __name__ == "__main__":
    setup()