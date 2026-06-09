from __future__ import annotations
from datetime import date, datetime, time
from decimal import Decimal
from pydantic import BaseModel, ConfigDict
from app.models.leave import LeaveType, LeaveStatus


class LeaveCreate(BaseModel):
    employee_id:  int
    location_id:  int | None = None
    type:         LeaveType
    start_date:   date
    end_date:     date
    # Pentru tipurile pe ore (Invoire / Overtime / Recuperare): interval orar
    # dintr-o singura zi; orele se calculeaza server-side din diferenta.
    start_time:   time | None = None
    end_time:     time | None = None
    notes:        str | None = None
    request_date: date | None = None
    employee_consent: bool = False


class LeavePatch(BaseModel):
    type:         LeaveType | None = None
    location_id:  int | None = None
    start_date:   date | None = None
    end_date:     date | None = None
    start_time:   time | None = None
    end_time:     time | None = None
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
    start_time:      time | None = None
    end_time:        time | None = None
    hours:           Decimal | None = None
    notes:           str | None
    approved_by:     int | None
    approver_name:   str | None = None
    approved_at:     datetime | None
    request_date:    date | None = None
    employee_consent:    bool = False
    employee_consent_at: datetime | None = None
    approver_consent:    bool = False
    approver_name_snapshot: str | None = None
    # `details_snapshot` (date legale sensibile) se serveste separat prin
    # GET /api/leaves/{id}/snapshot (scope=reports), nu in lista uzuala.
    created_at:      datetime
    updated_at:      datetime | None
    is_deleted:      bool
    deleted_at:      datetime | None


class LeaveConsent(BaseModel):
    employee_consent: bool = True


class LeaveApprove(BaseModel):
    # Acordul digital al aprobatorului — obligatoriu (validat in router).
    approver_consent: bool = False


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
    # --- Sold ore (tipuri pe ore: Invoire / Overtime / Recuperare) ---
    # Agregate pe cereri APROBATE in anul dat:
    overtime_hours:            float = 0.0
    permission_hours:          float = 0.0   # ore de invoire
    recovery_hours:            float = 0.0   # ore de recuperare
    permission_count:          int   = 0     # numar de invoiri
    # Sold net = overtime + recuperare - invoire (doar aprobate):
    net_hours_balance:         float = 0.0
    # Acelasi calcul pe cererile in asteptare (informativ):
    pending_overtime_hours:    float = 0.0
    pending_permission_hours:  float = 0.0
    pending_recovery_hours:    float = 0.0


class RomanianHoliday(BaseModel):
    date: date
    name: str
