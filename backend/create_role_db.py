from app.database import engine
from app.models.role_models import *

# Create only role tables
print("Creating role database tables...")
Base.metadata.create_all(bind=engine)
print("Role database tables created successfully!")