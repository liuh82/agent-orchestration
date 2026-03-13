from app.database import engine
from app.models.complete_orm import *

# Create all tables
print("Creating complete database tables...")
Base.metadata.create_all(bind=engine)
print("Complete database tables created successfully!")