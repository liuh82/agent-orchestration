#!/usr/bin/env python3
"""
Script to update all router files to inject database session
"""

import re

# List of routers to update
routers = [
    'agents.py',
    'cost.py',
    'heartbeats.py',
    'workflows.py'
]

# Patterns to match function definitions
func_patterns = [
    r'@router\.get\([^)]+\)\s*async def (\w+)\(',
    r'@router\.post\([^)]+\)\s*async def (\w+)\(',
    r'@router\.put\([^)]+\)\s*async def (\w+)\(',
    r'@router\.delete\([^)]+\)\s*async def (\w+)\(',
    r'@router\.patch\([^)]+\)\s*async def (\w+)\(',
]

for router_file in routers:
    print(f"\nUpdating {router_file}...")

    # Read the file
    with open(f'app/routers/{router_file}', 'r') as f:
        content = f.read()

    # Add db parameter to functions that don't have it
    lines = content.split('\n')
    new_lines = []
    i = 0

    while i < len(lines):
        line = lines[i]

        # Check if this line is a function definition that needs db parameter
        needs_db = False
        for pattern in func_patterns:
            if re.search(pattern, line):
                # Extract function name
                match = re.search(r'async def (\w+)\(', line)
                if match:
                    func_name = match.group(1)
                    # Don't add db to certain special functions
                    if func_name not in ['override_get_db']:  # Add any exceptions here
                        needs_db = True
                        break

        if needs_db:
            # Add db parameter
            if 'db = Depends(get_db)' not in line:
                # Find the parameter closing parenthesis
                param_end = line.find('):')
                if param_end != -1:
                    # Insert db parameter before the closing parenthesis
                    new_line = line[:param_end] + ', db = Depends(get_db)' + line[param_end:]
                    new_lines.append(new_line)
                    i += 1
                    continue

        new_lines.append(line)
        i += 1

    # Write back the updated content
    new_content = '\n'.join(new_lines)

    # Remove service instantiation at top level (if exists)
    new_content = re.sub(r'(\w+)_service = (\w+)Service\(\)\n', '', new_content)

    with open(f'app/routers/{router_file}', 'w') as f:
        f.write(new_content)

    print(f"✓ Updated {router_file}")

print("\nRouter update complete!")