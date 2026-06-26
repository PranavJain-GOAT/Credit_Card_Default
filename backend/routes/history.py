import traceback
from fastapi import APIRouter, HTTPException
from schemas.applicant import HistoryRequest, DeleteRequest
from services.db_service import get_history, get_record_by_id, delete_record

router = APIRouter()


@router.post("/history", tags=["History"])
def history_endpoint(body: HistoryRequest):
    """
    Retrieve prediction history.

    - Pass `id` to fetch a single full record.
    - Pass `search` and `sort` to filter the list.
    """
    try:
        if body.id is not None:
            record = get_record_by_id(body.id)
            if not record:
                raise HTTPException(status_code=404, detail="Record not found")
            return record
        records = get_history(search=body.search, sort=body.sort)
        return {"records": records}
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/history/delete", tags=["History"])
def delete_endpoint(body: DeleteRequest):
    """Delete a prediction record by ID."""
    try:
        deleted = delete_record(body.id)
        return {"deleted": deleted, "id": body.id}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
