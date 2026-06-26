import traceback
from fastapi import APIRouter, HTTPException
from schemas.applicant import ChatRequest, ChatResponse
from services.gemini_service import get_chat_reply

router = APIRouter()


@router.post("/chat", response_model=ChatResponse, tags=["Chat"])
def chat_endpoint(body: ChatRequest):
    """
    AI chat endpoint powered by Gemini 2.5 Flash Lite.

    Accepts a question, the current applicant data, and prediction results.
    Falls back to a local rule-based responder if the API key is missing or Gemini fails.
    """
    try:
        reply = get_chat_reply(
            question=body.question,
            applicant_data=body.applicant_data,
            prediction_results=body.prediction_results,
            case_loaded=body.case_loaded,
            api_key=body.api_key,
        )
        return {"reply": reply}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
