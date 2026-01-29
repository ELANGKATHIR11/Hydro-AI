from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Boolean
from sqlalchemy.orm import sessionmaker, declarative_base
from datetime import datetime

DATABASE_URL = "sqlite:///./hydro_feedback.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class FeedbackEntry(Base):
    __tablename__ = "feedback"

    id = Column(Integer, primary_key=True, index=True)
    # Storing corrections
    original_area = Column(Float, nullable=True)
    corrected_area = Column(Float, nullable=True)
    original_risk = Column(String, nullable=True)
    corrected_risk = Column(String, nullable=True)
    is_correct = Column(Boolean, default=False)
    timestamp = Column(DateTime, default=datetime.utcnow)

def init_db():
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
