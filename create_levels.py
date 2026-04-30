import requests

# Login to get token
r = requests.post('http://127.0.0.1:8000/api/v1/auth/login', json={
    'email': 'admin@example.com',
    'password': 'AdminPass123!'
}, headers={'x-tenant-id': 'test-org'})

if r.status_code == 200:
    token = r.json()['access_token']
    headers = {'Authorization': f'Bearer {token}', 'x-tenant-id': 'test-org'}

    # Create levels
    levels = [
        {'name': 'Level 1', 'threshold_points': 100},
        {'name': 'Level 2', 'threshold_points': 300},
        {'name': 'Level 3', 'threshold_points': 600},
        {'name': 'Level 4', 'threshold_points': 1000},
        {'name': 'Level 5', 'threshold_points': 10000}  # High number for max level
    ]

    for level in levels:
        r = requests.post('http://127.0.0.1:8000/api/v1/gamification/admin/levels', json=level, headers=headers)
        print(f'Created {level["name"]}: {r.status_code}')
        if r.status_code != 201:
            print(f'Error: {r.text}')
else:
    print('Login failed:', r.text)