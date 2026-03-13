#!/usr/bin/env python3
"""
Script to update all router files to inject database session
"""

import os
import re

# List of routers to update
routers = [
    'agents.py',
    'cost.py',
    'heartbeats.py',
    'workflows.py'
]

# Add get_db import to each router
for router_file in routers:
    print(f"Updating {router_file}...")

    # Read the file
    with open(f'app/routers/{router_file}', 'r') as f:
        content = f.read()

    # Add get_db import if not present
    if 'from ..database import get_db' not in content:
        content = content.replace(
            'from fastapi import APIRouter, HTTPException, BackgroundTasks',
            'from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends'
        )
        content = content.replace(
            'from ..services.xxx import XxxService',
            'from ..services.xxx import XxxService\nfrom ..database import get_db'
        )

    # Replace all service instantiations to include db dependency
    # This is a simple pattern - may need adjustment for complex cases
    content = re.sub(
        r'(\w+)_service = (\w+)Service\(\)',
        lambda m: f'{m.group(1)}_service = {m.group(2)}Service(db)' if m.group(1) != 'task' else '',  # Skip task as it's already updated
        content
    )

    # Add db parameter to function definitions
    content = re.sub(
        r'async def (\w+)\(([^)]*)\):',
        lambda m: f'async def {m.group(1)}({m.group(2)}, db = Depends(get_db)):',
        content
    )

    # Write back
    with open(f'app/routers/{router_file}', 'w') as f:
        f.write(content)

    print(f"✓ Updated {router_file}")

print("\nRouter update complete!")