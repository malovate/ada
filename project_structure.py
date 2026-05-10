import os
from pathlib import Path

def make_folders():
    folders = ["backend", "mobile"]
    for fd in folders:
        dir_path = Path(fd)
        if dir_path.exists():
            print(f"{fd} folder already exists")
        else:
            dir_path.mkdir(parents=True, exist_ok=True)
            print(f"{fd} created")

make_folders()