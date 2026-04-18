from app.main import app
for route in app.routes:
    if '/submit' in route.path or '/submissions/me' in route.path:
        print(route.path, route.methods)
