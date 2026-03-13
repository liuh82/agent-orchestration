from app.database import engine
from app.models.org_models import *

# Create only org-related tables
print("Creating organization database tables...")
Base.metadata.create_all(bind=engine)
print("Organization database tables created successfully!")