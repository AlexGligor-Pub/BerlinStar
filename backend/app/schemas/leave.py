from __future__ import annotations
from datetime import date, datetime
from pydantic import BaseModel, ConfigDict
from app.models.leave import LeaveType, LeaveStatus


class LeaveCreate(BaseModel):
    employee_id:  int
    location_id:  int | None = None
    type:         LeaveType
    start_date:   date
    end_date:     date
    notes:        str | None = None


class LeavePatch(BaseModel):
    type:         LeaveType | None = None
    location_id:  int | None = None
    start_date:   date | None = None
    end_date:     date | None = None
    notes:        str | None = None


class LeaveRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:              int
    account_id:      int
    employee_id:     int
    employee_name:   str | None = None
    employee_image_path: str | None = None
    location_id:     int | None
    location_name:   str | None = None
    type:            LeaveType
    status:          LeaveStatus
    start_date:      date
    end_date:        date
    working_days:    int
    notes:           str | None
    approved_by:     int | None
    approver_name:   str | None = None
    approved_at:     datetime | None
    created_at:      datetime
    updated_at:      datetime | None
    is_deleted:      bool
    deleted_at:      datetime | None


class LeaveTypeBreakdown(BaseModel):
    type: LeaveType
    used_days: int
    pending_days: int


class LeaveBalance(BaseModel):
    employee_id:               int
    employee_name:             str
    year:                      int
    annual_allowance:          int
    used_vacation_days:        int
    pending_vacation_days:     int
    remaining_vacation_days:   int
    breakdown:                 list[LeaveTypeBreakdown]


class RomanianHoliday(BaseModel):
    date: date
    name: str
